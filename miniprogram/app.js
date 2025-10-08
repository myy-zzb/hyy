// app.js
App({
    onLaunch: function () {
        this.globalData = {
            // env 参数说明：
            //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
            //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
            //   如不填则使用默认环境（第一个创建的环境）
            env: "cloud1-5gl8qa4h2f229845",
            userInfo: null,
            isLoggedIn: false
        };
        
        if (!wx.cloud) {
            console.error("请使用 2.2.3 或以上的基础库以使用云能力");
        } else {
            wx.cloud.init({
                env: this.globalData.env,
                traceUser: true,
            });
        }

        // 检查本地登录状态
        this.checkLoginStatus();
    },

    // 检查登录状态
    checkLoginStatus: function() {
        try {
            const userInfo = wx.getStorageSync('userInfo');
            const loginTime = wx.getStorageSync('loginTime');
            
            if (userInfo && loginTime) {
                // 检查登录是否过期（7天有效期）
                const currentTime = Date.now();
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                
                if (currentTime - loginTime < sevenDays) {
                    // 登录未过期
                    this.globalData.userInfo = userInfo;
                    this.globalData.isLoggedIn = true;
                    console.log('自动登录成功', userInfo);
                } else {
                    // 登录已过期，清除本地数据
                    this.clearLoginStatus();
                    console.log('登录已过期，请重新登录');
                }
            } else {
                console.log('未找到登录信息');
            }
        } catch (e) {
            console.error('检查登录状态失败：', e);
        }
    },

    // 保存登录状态
    saveLoginStatus: function(userInfo) {
        try {
            wx.setStorageSync('userInfo', userInfo);
            wx.setStorageSync('loginTime', Date.now());
            this.globalData.userInfo = userInfo;
            this.globalData.isLoggedIn = true;
            console.log('登录状态已保存');
        } catch (e) {
            console.error('保存登录状态失败：', e);
        }
    },

    // 清除登录状态
    clearLoginStatus: function() {
        try {
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('loginTime');
            this.globalData.userInfo = null;
            this.globalData.isLoggedIn = false;
            console.log('登录状态已清除');
        } catch (e) {
            console.error('清除登录状态失败：', e);
        }
    },

    // 获取登录状态
    getLoginStatus: function() {
        return {
            isLoggedIn: this.globalData.isLoggedIn,
            userInfo: this.globalData.userInfo
        };
    }
});
