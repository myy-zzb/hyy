// miniprogram/pages/home/home.js
const app = getApp();
const db = wx.cloud.database();

Page({
    data: {
        userInfo: null,
        isLoggedIn: false,
        partnerInfo: null,
        loveStartDate: "",
        loveDays: 0,
        showBindModal: false,
        showRequestsModal: false,
        showAnniversaryModal: false,
        showPoopModal: false,  // 确保这个存在
        pendingRequestsCount: 0,
        showQuarrelModal: false
    },

    // 用于存储数据库监听器
    userWatcher: null,
    requestWatcher: null,

    onLoad(options) {
        this.checkLogin();
    },

    onShow() {
        this.checkLogin();
        // 启动数据监听
        this.startWatching();
    },

    onHide() {
        // 停止数据监听
        this.stopWatching();
    },

    onUnload() {
        // 停止数据监听
        this.stopWatching();
    },

    // 启动数据监听
    startWatching() {
        const userInfo = this.data.userInfo;
        if (!userInfo) return;

        // 监听用户信息变化
        this.userWatcher = db.collection("user").doc(userInfo._id).watch({
            onChange: (snapshot) => {
                console.log('用户信息发生变化', snapshot);
                if (snapshot.docs && snapshot.docs.length > 0) {
                    const updatedUser = snapshot.docs[0];
                    // 更新本地存储
                    app.saveLoginStatus(updatedUser);
                    this.setData({
                        userInfo: updatedUser
                    });
                    // 更新恋爱关系状态
                    this.updateRelationshipState(updatedUser);
                }
            },
            onError: (err) => {
                console.error('用户信息监听错误', err);
            }
        });

        // 监听待处理邀请数量变化
        this.requestWatcher = db.collection("partner_requests").where({
            toUserId: userInfo._id,
            status: "pending"
        }).watch({
            onChange: (snapshot) => {
                console.log('邀请列表发生变化', snapshot);
                this.setData({
                    pendingRequestsCount: snapshot.docs.length
                });
            },
            onError: (err) => {
                console.error('邀请列表监听错误', err);
            }
        });
    },

    // 停止数据监听
    stopWatching() {
        if (this.userWatcher) {
            this.userWatcher.close();
            this.userWatcher = null;
        }
        if (this.requestWatcher) {
            this.requestWatcher.close();
            this.requestWatcher = null;
        }
    },

    // 检查登录状态
    checkLogin: function() {
        const loginStatus = app.getLoginStatus();

        if (!loginStatus.isLoggedIn) {
            wx.reLaunch({
                url: "/pages/login/login"
            });
            return;
        }

        this.setData({
            userInfo: loginStatus.userInfo,
            isLoggedIn: true
        });

        this.updateRelationshipState(loginStatus.userInfo);
        this.refreshUserInfo();
        this.checkPendingRequests();
    },

    // 同步获取最新用户信息
    refreshUserInfo: function() {
        const user = this.data.userInfo || {};
        const userId = user._id;

        if (!userId) {
            return;
        }

        db.collection("user").doc(userId).get({
            success: (res) => {
                const freshUser = res.data;
                app.saveLoginStatus(freshUser);
                this.setData({
                    userInfo: freshUser,
                    isLoggedIn: true
                });
                this.updateRelationshipState(freshUser);
            },
            fail: (err) => {
                console.error("获取用户信息失败：", err);
            }
        });
    },

    // 检查待处理的邀请数量
    checkPendingRequests: function() {
        const userInfo = this.data.userInfo;
        if (!userInfo) return;

        db.collection("partner_requests").where({
            toUserId: userInfo._id,
            status: "pending"
        }).count({
            success: (res) => {
                this.setData({
                    pendingRequestsCount: res.total
                });
            }
        });
    },

    // 更新恋爱关系展示
    updateRelationshipState: function(userData) {
        const loveStartDate = userData.loveStartDate || "";
        const loveDays = this.calculateLoveDays(loveStartDate);

        this.setData({
            loveStartDate,
            loveDays
        });

        const partnerId = userData.partnerId;

        if (!partnerId) {
            this.setData({
                partnerInfo: null
            });
            return;
        }

        db.collection("user").doc(partnerId).get({
            success: (res) => {
                this.setData({
                    partnerInfo: res.data
                });
            },
            fail: (err) => {
                console.error("获取伴侣信息失败：", err);
                this.setData({
                    partnerInfo: null
                });
            }
        });
    },

    // 计算恋爱天数
    calculateLoveDays: function(startDate) {
        if (!startDate) {
            return 0;
        }

        const normalized = startDate.replace(/-/g, "/");
        const start = new Date(normalized);

        if (Number.isNaN(start.getTime())) {
            return 0;
        }

        const today = new Date();
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diff = Math.floor((todayDateOnly - startDateOnly) / 86400000);

        return diff >= 0 ? diff + 1 : 0;
    },

    // 打开绑定伴侣弹窗
    openBindModal: function() {
        const user = this.data.userInfo;

        if (user && user.partnerId) {
            wx.showToast({
                title: "不准",
                icon: "none"
            });
            return;
        }

        this.setData({
            showBindModal: true
        });
    },

    // 关闭绑定伴侣弹窗
    closeBindModal: function() {
        this.setData({
            showBindModal: false
        });
    },

    // 绑定成功回调
    onBindSuccess: function() {
        this.refreshUserInfo();
        this.checkPendingRequests();
    },

    // 打开邀请列表
    openRequestsModal: function() {
        this.setData({
            showRequestsModal: true
        });
    },

    // 关闭邀请列表
    closeRequestsModal: function() {
        this.setData({
            showRequestsModal: false
        });
        // 刷新数据
        this.refreshUserInfo();
        this.checkPendingRequests();
    },

    // 接受邀请成功回调
    onRequestSuccess: function() {
        this.setData({
            showRequestsModal: false
        });
        this.refreshUserInfo();
        this.checkPendingRequests();
    },

    // 打开纪念日列表 - 新增
    openAnniversaryModal: function() {
        this.setData({
            showAnniversaryModal: true
        });
    },

    // 关闭纪念日列表 - 新增
    closeAnniversaryModal: function() {
        this.setData({
            showAnniversaryModal: false
        });
    },

    // 打开吵架记录弹窗
    openQuarrelModal: function() {
        this.setData({
            showQuarrelModal: true
        });
    },

    // 关闭吵架记录弹窗
    closeQuarrelModal: function() {
        this.setData({
            showQuarrelModal: false
        });
    },

    // 打开拉屎弹窗
    openPoopModal: function() {
        this.setData({
            showPoopModal: true
        });
    },

    closePoopModal: function() {
        this.setData({
            showPoopModal: false
        });
    },

    onPullDownRefresh() {},
    onReachBottom() {},
    onShareAppMessage() {}
});