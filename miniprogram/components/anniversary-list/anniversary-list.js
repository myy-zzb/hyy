// miniprogram/components/anniversary-list/anniversary-list.js
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
        anniversaries: [],
        loading: false,
        showAddModal: false,
        editingId: null,
        uploadingImage: false,
        formData: {
            title: "",
            date: "",
            imageFileId: "",
            imageTempUrl: "",
            description: "",
            isYearly: true
        }
    },

    observers: {
        'show': function(show) {
            if (show) {
                this.loadAnniversaries();
            }
        }
    },

    methods: {
        // 生成共享文件夹路径
        getSharedFolderPath() {
            const userInfo = this.properties.userInfo;
            const partnerId = userInfo.partnerId;
            
            if (!partnerId) {
                return `anniversaries/${userInfo._id}`;
            }
            
            const ids = [userInfo._id, partnerId].sort();
            return `anniversaries/${ids[0]}_${ids[1]}`;
        },

        // 加载纪念日列表
        async loadAnniversaries() {
            const userInfo = this.properties.userInfo;
            if (!userInfo) return;

            this.setData({ loading: true });

            try {
                const res = await db.collection("anniversaries")
                    .where(db.command.or([
                        { userId: userInfo._id },
                        { partnerId: userInfo._id }
                    ]))
                    .orderBy('date', 'asc')
                    .get();

                console.log('查询到的纪念日数据：', res.data);

                // 收集所有需要获取临时链接的 fileID
                const fileIds = res.data
                    .filter(item => item.imageFileId)
                    .map(item => item.imageFileId);

                console.log('需要获取临时链接的图片：', fileIds);

                // 使用云函数批量获取临时链接
                let imageUrlMap = {};
                if (fileIds.length > 0) {
                    try {
                        const cloudRes = await wx.cloud.callFunction({
                            name: 'getTempFileURL',
                            data: {
                                fileList: fileIds
                            }
                        });
                        
                        console.log('云函数返回结果：', cloudRes);
                        
                        if (cloudRes.result.success) {
                            // 构建 fileID -> tempURL 的映射
                            cloudRes.result.fileList.forEach(file => {
                                if (file.tempFileURL) {
                                    imageUrlMap[file.fileID] = file.tempFileURL;
                                } else {
                                    console.error('获取临时链接失败：', file);
                                }
                            });
                        } else {
                            console.error('云函数执行失败：', cloudRes.result.error);
                        }
                    } catch (error) {
                        console.error('调用云函数失败：', error);
                    }
                }

                console.log('临时链接映射：', imageUrlMap);

                // 处理数据，添加临时链接和倒计时
                const anniversariesWithData = res.data.map(item => {
                    return {
                        ...item,
                        imageTempUrl: item.imageFileId ? (imageUrlMap[item.imageFileId] || '') : '',
                        daysLeft: this.calculateDaysLeft(item.date, item.isYearly)
                    };
                });

                this.setData({
                    anniversaries: anniversariesWithData,
                    loading: false
                });
            } catch (error) {
                console.error("加载纪念日失败：", error);
                this.setData({ loading: false });
            }
        },

        // 计算距离天数
        calculateDaysLeft(dateStr, isYearly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let targetDate = new Date(dateStr.replace(/-/g, '/'));
            targetDate.setHours(0, 0, 0, 0);
            
            if (isYearly) {
                targetDate.setFullYear(today.getFullYear());
                if (targetDate < today) {
                    targetDate.setFullYear(today.getFullYear() + 1);
                }
            }
            
            const diff = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
            
            if (diff === 0) {
                return "今天";
            } else if (diff < 0) {
                return `已过 ${Math.abs(diff)} 天`;
            } else {
                return `还有 ${diff} 天`;
            }
        },

        // 格式化日期
        formatDate(date) {
            const y = date.getFullYear();
            const m = `0${date.getMonth() + 1}`.slice(-2);
            const d = `0${date.getDate()}`.slice(-2);
            return `${y}-${m}-${d}`;
        },

        // 关闭弹窗
        closeModal() {
            this.triggerEvent('close');
        },

        // 打开添加纪念日弹窗
        openAddModal() {
            this.setData({
                showAddModal: true,
                editingId: null,
                formData: {
                    title: "",
                    date: this.formatDate(new Date()),
                    imageFileId: "",
                    imageTempUrl: "",
                    description: "",
                    isYearly: true
                }
            });
        },

        // 关闭添加/编辑弹窗
        closeAddModal() {
            this.setData({
                showAddModal: false,
                editingId: null
            });
        },

        // 选择图片
        chooseImage() {
            wx.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    this.uploadImage(tempFilePath);
                }
            });
        },

        // 上传图片到云存储
        async uploadImage(filePath) {
            this.setData({ uploadingImage: true });
            wx.showLoading({ title: '上传中...' });

            try {
                const timestamp = Date.now();
                const sharedFolder = this.getSharedFolderPath();
                const cloudPath = `${sharedFolder}/${timestamp}.jpg`;

                console.log('上传图片到共享文件夹：', cloudPath);

                const uploadRes = await wx.cloud.uploadFile({
                    cloudPath: cloudPath,
                    filePath: filePath
                });

                console.log('图片上传成功，fileID：', uploadRes.fileID);

                // 使用云函数获取临时链接用于预览
                const cloudRes = await wx.cloud.callFunction({
                    name: 'getTempFileURL',
                    data: {
                        fileList: [uploadRes.fileID]
                    }
                });

                let tempFileURL = '';
                if (cloudRes.result.success && cloudRes.result.fileList.length > 0) {
                    tempFileURL = cloudRes.result.fileList[0].tempFileURL;
                }

                console.log('获取到临时链接：', tempFileURL);

                wx.hideLoading();
                this.setData({
                    'formData.imageFileId': uploadRes.fileID,
                    'formData.imageTempUrl': tempFileURL,
                    uploadingImage: false
                });

                wx.showToast({
                    title: '上传成功',
                    icon: 'success'
                });
            } catch (error) {
                console.error('上传图片失败：', error);
                wx.hideLoading();
                this.setData({ uploadingImage: false });
                wx.showToast({
                    title: '上传失败',
                    icon: 'none'
                });
            }
        },

        // 删除图片
        deleteImage() {
            wx.showModal({
                title: '确认删除',
                content: '确定要删除这张图片吗？',
                success: (res) => {
                    if (res.confirm) {
                        this.setData({
                            'formData.imageFileId': '',
                            'formData.imageTempUrl': ''
                        });
                    }
                }
            });
        },

        // 预览图片
        previewImage(e) {
            const url = e.currentTarget.dataset.url;
            if (!url) {
                wx.showToast({
                    title: '图片加载中...',
                    icon: 'none'
                });
                return;
            }
            wx.previewImage({
                current: url,
                urls: [url]
            });
        },

        // 表单输入处理
        onTitleInput(e) {
            this.setData({
                'formData.title': e.detail.value
            });
        },

        onDateChange(e) {
            this.setData({
                'formData.date': e.detail.value
            });
        },

        onDescriptionInput(e) {
            this.setData({
                'formData.description': e.detail.value
            });
        },

        onYearlyChange(e) {
            this.setData({
                'formData.isYearly': e.detail.value
            });
        },

        // 提交表单
        async submitForm() {
            const { title, date, imageFileId, description, isYearly } = this.data.formData;
            const userInfo = this.properties.userInfo;

            if (!title) {
                wx.showToast({
                    title: "请输入纪念日标题",
                    icon: "none"
                });
                return;
            }

            if (!date) {
                wx.showToast({
                    title: "请选择日期",
                    icon: "none"
                });
                return;
            }

            if (!imageFileId) {
                wx.showToast({
                    title: "请上传纪念日图片",
                    icon: "none"
                });
                return;
            }

            wx.showLoading({ title: "保存中..." });

            try {
                const data = {
                    title,
                    date,
                    imageFileId,
                    description,
                    isYearly,
                    partnerId: userInfo.partnerId || null,
                    updateTime: db.serverDate()
                };

                console.log('保存纪念日数据：', data);

                if (this.data.editingId) {
                    await db.collection("anniversaries").doc(this.data.editingId).update({
                        data
                    });
                } else {
                    const addRes = await db.collection("anniversaries").add({
                        data: {
                            ...data,
                            userId: userInfo._id,
                            createTime: db.serverDate()
                        }
                    });
                    console.log('添加纪念日成功：', addRes);
                }

                wx.hideLoading();
                wx.showToast({
                    title: "保存成功",
                    icon: "success"
                });

                this.closeAddModal();
                this.loadAnniversaries();
            } catch (error) {
                console.error("保存纪念日失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "保存失败",
                    icon: "none"
                });
            }
        },

        // 删除纪念日
        deleteAnniversary(e) {
            const item = e.currentTarget.dataset.item;
            
            wx.showModal({
                title: "确认删除",
                content: `确定要删除"${item.title}"吗？`,
                success: async (res) => {
                    if (res.confirm) {
                        await this.handleDelete(item);
                    }
                }
            });
        },

        // 处理删除
        async handleDelete(item) {
            wx.showLoading({ title: "删除中..." });

            try {
                // 删除云存储中的图片
                if (item.imageFileId) {
                    try {
                        await wx.cloud.deleteFile({
                            fileList: [item.imageFileId]
                        });
                        console.log('删除云存储图片成功：', item.imageFileId);
                    } catch (error) {
                        console.error('删除图片失败：', error);
                    }
                }

                // 删除数据库记录
                await db.collection("anniversaries").doc(item._id).remove();

                wx.hideLoading();
                wx.showToast({
                    title: "删除成功",
                    icon: "success"
                });

                this.loadAnniversaries();
            } catch (error) {
                console.error("删除失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "删除失败",
                    icon: "none"
                });
            }
        }
    }
});