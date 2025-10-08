// pages/login/login.js
const db = wx.cloud.database();
const app = getApp();

Page({
    data: {
        phone: "",
        password: "",
        confirmPassword: "",
        gender: "", // 性别：male-男生, female-女生
        showPassword: false,
        showConfirmPassword: false,
        isRegisterMode: false // false-登录模式, true-注册模式
    },

    // 手机号输入
    onPhoneInput: function (e) {
        this.setData({ phone: e.detail.value });
    },

    // 密码输入
    onPasswordInput: function (e) {
        this.setData({ password: e.detail.value });
    },

    // 确认密码输入
    onConfirmPasswordInput: function (e) {
        this.setData({ confirmPassword: e.detail.value });
    },

    // 选择性别
    selectGender: function (e) {
        const gender = e.currentTarget.dataset.gender;
        console.log('选择性别：', gender);
        this.setData({ gender: gender });
    },

    // 切换密码可见性
    togglePassword: function () {
        console.log('切换密码显示状态，当前：', this.data.showPassword);
        this.setData({ 
            showPassword: !this.data.showPassword 
        });
        console.log('切换后：', this.data.showPassword);
    },

    // 切换确认密码可见性
    toggleConfirmPassword: function () {
        console.log('切换确认密码显示状态，当前：', this.data.showConfirmPassword);
        this.setData({ 
            showConfirmPassword: !this.data.showConfirmPassword 
        });
        console.log('切换后：', this.data.showConfirmPassword);
    },

    // 切换登录/注册模式
    switchMode: function () {
        this.setData({
            isRegisterMode: !this.data.isRegisterMode,
            password: "",
            confirmPassword: "",
            gender: "",
            showPassword: false,
            showConfirmPassword: false
        });
    },

    // 验证手机号
    validatePhone: function (phone) {
        const reg = /^1[3-9]\d{9}$/;
        return reg.test(phone);
    },

    // 验证密码
    validatePassword: function (password) {
        return password.length >= 6 && password.length <= 20;
    },

    // 提交表单
    handleSubmit: function () {
        const { phone, password, confirmPassword, gender, isRegisterMode } = this.data;

        // 验证手机号
        if (!this.validatePhone(phone)) {
            wx.showToast({
                title: '请输入正确的手机号',
                icon: 'none'
            });
            return;
        }

        // 验证密码
        if (!this.validatePassword(password)) {
            wx.showToast({
                title: '密码长度为6-20位',
                icon: 'none'
            });
            return;
        }

        // 注册模式需要额外验证
        if (isRegisterMode) {
            // 验证确认密码
            if (password !== confirmPassword) {
                wx.showToast({
                    title: '两次密码不一致',
                    icon: 'none'
                });
                return;
            }

            // 验证性别
            if (!gender) {
                wx.showToast({
                    title: '请选择性别',
                    icon: 'none'
                });
                return;
            }

            this.handleRegister();
        } else {
            this.handleLogin();
        }
    },

    // 处理注册
    handleRegister: function () {
        const { phone, password, gender } = this.data;

        wx.showLoading({ title: '注册中...' });

        // 先查询手机号是否已存在
        db.collection('user').where({
            phone: phone
        }).get({
            success: (res) => {
                if (res.data.length > 0) {
                    wx.hideLoading();
                    wx.showToast({
                        title: '该手机号已注册',
                        icon: 'none'
                    });
                    return;
                }

                // 手机号未注册，创建新用户
                const genderText = gender === 'male' ? '男' : '女';
                const defaultAvatar = '/images/default.png';

                db.collection('user').add({
                    data: {
                        phone: phone,
                        password: password,
                        gender: gender,
                        genderText: genderText,
                        username: genderText + '用户' + phone.slice(-4),
                        avatarUrl: defaultAvatar,
                        partnerId: null,
                        partnerPhone: "",
                        loveStartDate: "",
                        createTime: db.serverDate()
                    },
                    success: (addRes) => {
                        wx.hideLoading();
                        wx.showToast({
                            title: '注册成功',
                            icon: 'success'
                        });

                        // 注册成功后自动登录
                        setTimeout(() => {
                            this.loginSuccess({
                                _id: addRes._id,
                                phone: phone,
                                gender: gender,
                                genderText: genderText,
                                username: genderText + '用户' + phone.slice(-4),
                                avatarUrl: defaultAvatar,
                                partnerId: null,
                                partnerPhone: "",
                                loveStartDate: ""
                            });
                        }, 1500);
                    },
                    fail: (err) => {
                        wx.hideLoading();
                        console.error('注册失败：', err);
                        wx.showToast({
                            title: '注册失败，请重试',
                            icon: 'none'
                        });
                    }
                });
            },
            fail: (err) => {
                wx.hideLoading();
                console.error('查询失败：', err);
                wx.showToast({
                    title: '网络错误，请重试',
                    icon: 'none'
                });
            }
        });
    },

    // 处理登录
    handleLogin: function () {
        const { phone, password } = this.data;

        wx.showLoading({ title: '登录中...' });

        // 查询用户
        db.collection('user').where({
            phone: phone
        }).get({
            success: (res) => {
                wx.hideLoading();

                if (res.data.length === 0) {
                    wx.showToast({
                        title: '该手机号未注册',
                        icon: 'none'
                    });
                    return;
                }

                const user = res.data[0];

                // 验证密码
                if (user.password !== password) {
                    wx.showToast({
                        title: '密码错误',
                        icon: 'none'
                    });
                    return;
                }

                // 登录成功
                this.loginSuccess(user);
            },
            fail: (err) => {
                wx.hideLoading();
                console.error('登录失败：', err);
                wx.showToast({
                    title: '网络错误，请重试',
                    icon: 'none'
                });
            }
        });
    },

    // 登录成功处理
    loginSuccess: function (userInfo) {
        // 使用全局方法保存登录状态
        app.saveLoginStatus({
            _id: userInfo._id,
            phone: userInfo.phone,
            gender: userInfo.gender,
            genderText: userInfo.genderText,
            username: userInfo.username,
            avatarUrl: userInfo.avatarUrl,
            partnerId: userInfo.partnerId || null,
            partnerPhone: userInfo.partnerPhone || "",
            loveStartDate: userInfo.loveStartDate || ""
        });

        wx.showToast({
            title: '登录成功',
            icon: 'success'
        });

        // 跳转到首页 - 使用 switchTab 跳转到 tabBar 页面
        setTimeout(() => {
            wx.switchTab({
                url: '/pages/home/home'
            });
        }, 300);
    },

    onLoad: function (options) {
        
    },
    onReady: function () { },
    onShow: function () { 
        wx.hideHomeButton();
        // 检查是否已登录
        const loginStatus = app.getLoginStatus();
        if (loginStatus.isLoggedIn) {
            wx.switchTab({
                url: '/pages/home/home'
            });
        }
    },
    onHide: function () { },
    onUnload: function () { },
    onPullDownRefresh: function () { },
    onReachBottom: function () { },
    onShareAppMessage: function () { }
})