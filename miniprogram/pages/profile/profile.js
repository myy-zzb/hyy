// pages/profile/profile.js
const app = getApp();
const db = wx.cloud.database();

Page({
    data: {
        userInfo: null,
        isLoggedIn: false,
        showEditModal: false,
        editNickname: "",
        editAvatarUrl: "",
        partnerInfo: null
    },

    onLoad(options) {
        this.checkLogin();
    },

    onShow() {
        this.checkLogin();
    },

    // 检查登录状态
    checkLogin: function() {
        const loginStatus = app.getLoginStatus();
        
        if (!loginStatus.isLoggedIn) {
            wx.reLaunch({
                url: '/pages/login/login'
            });
        } else {
            this.setData({
                userInfo: loginStatus.userInfo,
                isLoggedIn: true
            });
            this.fetchPartnerInfo(loginStatus.userInfo.partnerId);
        }
    },

    // 获取伴侣信息
    fetchPartnerInfo: function(partnerId) {
        if (!partnerId) {
            this.setData({
                partnerInfo: null
            });
            return;
        }

        db.collection('user').doc(partnerId).get({
            success: (res) => {
                this.setData({
                    partnerInfo: res.data
                });
            },
            fail: (err) => {
                console.error('获取伴侣信息失败：', err);
                this.setData({
                    partnerInfo: null
                });
            }
        });
    },

    // 编辑资料
    editProfile: function() {
        this.setData({
            showEditModal: true,
            editNickname: this.data.userInfo.username,
            editAvatarUrl: this.data.userInfo.avatarUrl
        });
    },

    // 选择头像
    onChooseAvatar: function(e) {
        const { avatarUrl } = e.detail;
        
        wx.showLoading({ title: '上传中...' });
        
        const cloudPath = 'avatars/' + this.data.userInfo._id + '_' + Date.now() + '.png';
        
        wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: avatarUrl,
            success: (res) => {
                wx.hideLoading();
                this.setData({
                    editAvatarUrl: res.fileID
                });
                wx.showToast({
                    title: '头像上传成功',
                    icon: 'success'
                });
            },
            fail: (err) => {
                wx.hideLoading();
                console.error('头像上传失败：', err);
                wx.showToast({
                    title: '上传失败',
                    icon: 'none'
                });
            }
        });
    },

    // 输入昵称
    onEditNickname: function(e) {
        this.setData({
            editNickname: e.detail.value
        });
    },

    // 取消编辑
    cancelEdit: function() {
        this.setData({
            showEditModal: false
        });
    },

    // 确认编辑
    confirmEdit: function() {
        const { editNickname, editAvatarUrl, userInfo } = this.data;

        if (!editNickname) {
            wx.showToast({
                title: '请输入昵称',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({ title: '保存中...' });

        db.collection("user").doc(userInfo._id).update({
            data: {
                username: editNickname,
                avatarUrl: editAvatarUrl
            },
            success: (res) => {
                wx.hideLoading();

                // 更新本地存储和全局状态
                const newUserInfo = {
                    ...userInfo,
                    username: editNickname,
                    avatarUrl: editAvatarUrl
                };
                app.saveLoginStatus(newUserInfo);

                this.setData({
                    userInfo: newUserInfo,
                    showEditModal: false
                });

                this.fetchPartnerInfo(newUserInfo.partnerId);

                wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                });
            },
            fail: (err) => {
                wx.hideLoading();
                console.error('保存失败：', err);
                wx.showToast({
                    title: '保存失败',
                    icon: 'none'
                });
            }
        });
    },

    // 退出登录
    handleLogout: function() {
        wx.showModal({
            title: '提示',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    app.clearLoginStatus();
                    
                    wx.showToast({
                        title: '已退出登录',
                        icon: 'success'
                    });

                    setTimeout(() => {
                        wx.reLaunch({
                            url: '/pages/login/login'
                        });
                    }, 300);
                }
            }
        });
    },

    onHide() {},
    onUnload() {},
    onPullDownRefresh() {},
    onReachBottom() {},
    onShareAppMessage() {}
})