// miniprogram/components/bind-partner/bind-partner.js
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
        bindPhone: "",
        bindDate: "",
        isBinding: false
    },

    lifetimes: {
        attached() {
            this.setData({
                bindDate: this.formatDate(new Date())
            });
        }
    },

    methods: {
        // 关闭弹窗
        closeModal() {
            this.triggerEvent('close');
            this.setData({
                bindPhone: "",
                bindDate: this.formatDate(new Date()),
                isBinding: false
            });
        },

        // 输入伴侣手机号
        onBindPhoneInput(e) {
            this.setData({
                bindPhone: e.detail.value.trim()
            });
        },

        // 选择恋爱开始日期
        onBindDateChange(e) {
            this.setData({
                bindDate: e.detail.value
            });
        },

        // 提交绑定请求
        async submitBindPartner() {
            if (this.data.isBinding) {
                return;
            }

            const { bindPhone, bindDate } = this.data;
            const userInfo = this.properties.userInfo;
            const phoneReg = /^1[3-9]\d{9}$/;

            if (!bindPhone || !phoneReg.test(bindPhone)) {
                wx.showToast({
                    title: "请输入正确的手机号",
                    icon: "none"
                });
                return;
            }

            if (!bindDate) {
                wx.showToast({
                    title: "请选择恋爱开始日期",
                    icon: "none"
                });
                return;
            }

            if (userInfo.phone === bindPhone) {
                wx.showToast({
                    title: "不能绑定自己",
                    icon: "none"
                });
                return;
            }

            try {
                this.setData({ isBinding: true });
                wx.showLoading({
                    title: "发送中...",
                    mask: true
                });

                // 检查当前用户是否已绑定
                const currentRes = await db.collection("user").doc(userInfo._id).get();
                const currentUser = currentRes.data;

                if (currentUser.partnerId) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "已绑定伴侣",
                        icon: "none"
                    });
                    this.setData({ isBinding: false });
                    return;
                }

                // 查找对方用户
                const partnerRes = await db.collection("user").where({
                    phone: bindPhone
                }).get();

                if (!partnerRes.data.length) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "未找到该用户",
                        icon: "none"
                    });
                    this.setData({ isBinding: false });
                    return;
                }

                const partner = partnerRes.data[0];

                // 检查对方是否已绑定
                if (partner.partnerId) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "对方已绑定伴侣",
                        icon: "none"
                    });
                    this.setData({ isBinding: false });
                    return;
                }

                // 检查是否已经发送过请求
                const existingReq = await db.collection("partner_requests").where({
                    fromUserId: currentUser._id,
                    toUserId: partner._id,
                    status: "pending"
                }).get();

                if (existingReq.data.length > 0) {
                    wx.hideLoading();
                    wx.showToast({
                        title: "已发送过邀请，请等待对方回应",
                        icon: "none"
                    });
                    this.setData({ isBinding: false });
                    return;
                }

                // 创建绑定请求
                await db.collection("partner_requests").add({
                    data: {
                        fromUserId: currentUser._id,
                        fromUserPhone: currentUser.phone,
                        fromUserName: currentUser.username,
                        toUserId: partner._id,
                        toUserPhone: partner.phone,
                        loveStartDate: bindDate,
                        status: "pending",
                        createTime: db.serverDate(),
                        updateTime: db.serverDate()
                    }
                });

                wx.hideLoading();
                wx.showToast({
                    title: "邀请已发送",
                    icon: "success"
                });

                this.closeModal();
                this.triggerEvent('success');
            } catch (error) {
                console.error("发送邀请失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "发送失败，请重试",
                    icon: "none"
                });
            } finally {
                this.setData({
                    isBinding: false
                });
            }
        },

        // 格式化日期
        formatDate(date) {
            const y = date.getFullYear();
            const m = `0${date.getMonth() + 1}`.slice(-2);
            const d = `0${date.getDate()}`.slice(-2);
            return `${y}-${m}-${d}`;
        }
    }
});