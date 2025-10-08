// pages/shouye/shouye.js
const app = getApp();

Page({
    data: {
        userInfo: null,
        isLoggedIn: false
    },

    onLoad(options) {
        // 检查登录状态
        this.checkLogin();
    },

    onReady() {
        wx.hideHomeButton();
    },

    onShow() {
        // 每次显示页面时检查登录状态
        this.checkLogin();
    },

    // 检查登录状态
    checkLogin: function() {
        const loginStatus = app.getLoginStatus();
        
        if (!loginStatus.isLoggedIn) {
            // 未登录，跳转到登录页
            wx.reLaunch({
                url: '/pages/login/login'
            });
        } else {
            // 已登录，显示用户信息
            this.setData({
                userInfo: loginStatus.userInfo,
                isLoggedIn: true
            });
            console.log('当前登录用户：', loginStatus.userInfo);
        }
    },

    // 退出登录
    handleLogout: function() {
        wx.showModal({
            title: '提示',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    // 清除登录状态
                    app.clearLoginStatus();
                    
                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    });

                    // 跳转到登录页
                    setTimeout(() => {
                        wx.reLaunch({
                            url: '/pages/login/login'
                        });
                    }, 1500);
                }
            }
        });
    },

    onHide() { },
    onUnload() { },
    onPullDownRefresh() { },
    onReachBottom() { },
    onShareAppMessage() { }
})