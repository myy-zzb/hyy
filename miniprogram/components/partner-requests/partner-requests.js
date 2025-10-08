// miniprogram/components/partner-requests/partner-requests.js
const db = wx.cloud.database();
const app = getApp();

Component({
    properties: {
        show: {
            type: Boolean,
            value: false
        },
        userInfo: {
            type: Object,
            value: null
        }
    },

    data: {
        requests: [],
        loading: false
    },

    observers: {
        'show': function(show) {
            if (show) {
                this.loadRequests();
            }
        }
    },

    methods: {
        // 加载邀请列表
        async loadRequests() {
            const userInfo = this.properties.userInfo;
            if (!userInfo) return;

            this.setData({ loading: true });

            try {
                const res = await db.collection("partner_requests").where({
                    toUserId: userInfo._id,
                    status: "pending"
                }).orderBy('createTime', 'desc').get();

                this.setData({
                    requests: res.data,
                    loading: false
                });
            } catch (error) {
                console.error("加载邀请列表失败：", error);
                this.setData({ loading: false });
            }
        },

        // 关闭弹窗
        closeModal() {
            this.triggerEvent('close');
        },

        // 接受邀请
        async acceptRequest(e) {
            const request = e.currentTarget.dataset.request;
            
            wx.showModal({
                title: '确认绑定',
                content: `确定要与 ${request.fromUserName || request.fromUserPhone} 绑定为伴侣吗？`,
                success: async (res) => {
                    if (res.confirm) {
                        await this.handleAccept(request);
                    }
                }
            });
        },

        // 处理接受邀请
        async handleAccept(request) {
            wx.showLoading({ title: '处理中...', mask: true });

            try {
                const userInfo = this.properties.userInfo;

                // 再次检查双方是否已绑定
                const [currentRes, partnerRes] = await Promise.all([
                    db.collection("user").doc(userInfo._id).get(),
                    db.collection("user").doc(request.fromUserId).get()
                ]);

                const currentUser = currentRes.data;
                const partner = partnerRes.data;

                // 检查当前用户是否已绑定
                if (currentUser.partnerId) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "您已绑定伴侣",
                        icon: "none"
                    });
                    await this.loadRequests();
                    return;
                }

                // 检查对方是否已绑定
                if (partner.partnerId) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "对方已绑定伴侣",
                        icon: "none"
                    });
                    await this.loadRequests();
                    return;
                }

                console.log('开始更新数据库...');
                console.log('当前用户:', currentUser._id);
                console.log('伴侣用户:', partner._id);
                console.log('请求ID:', request._id);

                // 更新双方用户信息和请求状态（确保三个更新都执行）
                const updateResults = await Promise.all([
                    // 更新当前用户（接受者）
                    db.collection("user").doc(currentUser._id).update({
                        data: {
                            partnerId: partner._id,
                            partnerPhone: partner.phone,
                            loveStartDate: request.loveStartDate
                        }
                    }),
                    // 更新伴侣用户（发起者）
                    db.collection("user").doc(partner._id).update({
                        data: {
                            partnerId: currentUser._id,
                            partnerPhone: currentUser.phone,
                            loveStartDate: request.loveStartDate
                        }
                    }),
                    // 更新请求状态为已接受
                    db.collection("partner_requests").doc(request._id).update({
                        data: {
                            status: "accepted",
                            updateTime: db.serverDate()
                        }
                    })
                ]);

                console.log('数据库更新结果:', updateResults);
                console.log('更新成功 - 接受者:', updateResults[0].stats);
                console.log('更新成功 - 发起者:', updateResults[1].stats);
                console.log('更新成功 - 请求状态:', updateResults[2].stats);

                // 验证更新结果
                const allSuccess = updateResults.every(result => 
                    result.stats && result.stats.updated === 1
                );

                if (!allSuccess) {
                    console.error('部分更新失败', updateResults);
                    wx.hideLoading();
                    wx.showToast({
                        title: "更新失败，请重试",
                        icon: "none"
                    });
                    return;
                }

                // 更新本地用户信息
                const updatedUser = {
                    ...currentUser,
                    partnerId: partner._id,
                    partnerPhone: partner.phone,
                    loveStartDate: request.loveStartDate
                };
                app.saveLoginStatus(updatedUser);

                wx.hideLoading();
                wx.showToast({
                    title: "绑定成功",
                    icon: "success"
                });

                // 延迟关闭弹窗，让用户看到成功提示
                setTimeout(() => {
                    this.closeModal();
                    this.triggerEvent('success');
                }, 500);
            } catch (error) {
                console.error("接受邀请失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "操作失败：" + error.message,
                    icon: "none"
                });
            }
        },

        // 拒绝邀请
        async rejectRequest(e) {
            const request = e.currentTarget.dataset.request;
            
            wx.showModal({
                title: '确认拒绝',
                content: '确定要拒绝这个邀请吗？',
                success: async (res) => {
                    if (res.confirm) {
                        await this.handleReject(request);
                    }
                }
            });
        },

        // 处理拒绝邀请
        async handleReject(request) {
            wx.showLoading({ title: '处理中...' });

            try {
                const updateResult = await db.collection("partner_requests").doc(request._id).update({
                    data: {
                        status: "rejected",
                        updateTime: db.serverDate()
                    }
                });

                console.log('拒绝邀请更新结果:', updateResult);

                wx.hideLoading();
                wx.showToast({
                    title: "已拒绝",
                    icon: "success"
                });

                // 重新加载列表，移除已拒绝的请求
                await this.loadRequests();
            } catch (error) {
                console.error("拒绝邀请失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "操作失败",
                    icon: "none"
                });
            }
        }
    }
});