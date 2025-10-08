// miniprogram/components/poop-list/poop-list.js
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
        poops: [],
        loading: false,
        showAddModal: false,
        showDetailModal: false,
        currentPoop: null,
        stats: {
            total: 0,
            todayCount: 0,
            weekCount: 0
        },
        formData: {
            poopDate: "",
            poopTime: "",
            poopType: "normal",
            duration: 5,
            feeling: "comfortable",
            location: "home",
            hasBlood: false,
            color: "brown",
            smell: "medium",
            note: ""
        },
        poopTypeOptions: [
            { value: 'dry', label: '干巴巴', emoji: '💩', color: '#8B4513' },
            { value: 'normal', label: '正常', emoji: '💩', color: '#D2691E' },
            { value: 'loose', label: '拉稀', emoji: '💩', color: '#DAA520' },
            { value: 'watery', label: '水样', emoji: '💧', color: '#4682B4' }
        ],
        feelingOptions: [
            { value: 'comfortable', label: '舒畅', emoji: '😌' },
            { value: 'normal', label: '一般', emoji: '😐' },
            { value: 'painful', label: '痛苦', emoji: '😣' }
        ],
        locationOptions: [
            { value: 'home', label: '家里', emoji: '🏠' },
            { value: 'office', label: '学校', emoji: '🏢' },
            { value: 'outside', label: '外面', emoji: '🚻' }
        ],
        colorOptions: [
            { value: 'brown', label: '棕色', color: '#8B4513' },
            { value: 'yellow', label: '黄色', color: '#FFD700' },
            { value: 'green', label: '绿色', color: '#228B22' },
            { value: 'black', label: '黑色', color: '#000000' }
        ],
        smellOptions: [
            { value: 'light', label: '轻微', emoji: '👃' },
            { value: 'medium', label: '中等', emoji: '🤢' },
            { value: 'strong', label: '强烈', emoji: '🤮' }
        ]
    },

    observers: {
        'show': function(show) {
            if (show) {
                this.loadPoops();
            }
        }
    },

    methods: {
        // 加载拉屎记录列表
        async loadPoops() {
            const userInfo = this.properties.userInfo;
            if (!userInfo) return;

            this.setData({ loading: true });

            try {
                const res = await db.collection("poop_records")
                    .where(db.command.or([
                        { userId: userInfo._id },
                        { partnerId: userInfo._id }
                    ]))
                    .orderBy('poopDate', 'desc')
                    .orderBy('poopTime', 'desc')
                    .get();

                console.log('查询到的拉屎记录：', res.data);

                const poopsWithInfo = res.data.map(item => {
                    const typeInfo = this.data.poopTypeOptions.find(t => t.value === item.poopType) || this.data.poopTypeOptions[1];
                    const feelingInfo = this.data.feelingOptions.find(f => f.value === item.feeling) || this.data.feelingOptions[0];
                    const locationInfo = this.data.locationOptions.find(l => l.value === item.location) || this.data.locationOptions[0];
                    const colorInfo = this.data.colorOptions.find(c => c.value === item.color) || this.data.colorOptions[0];
                    const smellInfo = this.data.smellOptions.find(s => s.value === item.smell) || this.data.smellOptions[1];
                    
                    return {
                        ...item,
                        typeLabel: typeInfo.label,
                        typeEmoji: typeInfo.emoji,
                        typeColor: typeInfo.color,
                        feelingLabel: feelingInfo.label,
                        feelingEmoji: feelingInfo.emoji,
                        locationLabel: locationInfo.label,
                        locationEmoji: locationInfo.emoji,
                        colorLabel: colorInfo.label,
                        colorValue: colorInfo.color,
                        smellLabel: smellInfo.label,
                        smellEmoji: smellInfo.emoji
                    };
                });

                // 计算统计数据
                const today = new Date();
                const todayStr = this.formatDate(today);
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                const weekAgoStr = this.formatDate(weekAgo);

                const stats = {
                    total: poopsWithInfo.length,
                    todayCount: poopsWithInfo.filter(p => p.poopDate === todayStr).length,
                    weekCount: poopsWithInfo.filter(p => p.poopDate >= weekAgoStr).length
                };

                this.setData({
                    poops: poopsWithInfo,
                    stats: stats,
                    loading: false
                });
            } catch (error) {
                console.error("加载拉屎记录失败：", error);
                this.setData({ loading: false });
            }
        },

        // 关闭弹窗
        closeModal() {
            this.triggerEvent('close');
        },

        // 打开添加记录弹窗
        openAddModal() {
            const now = new Date();
            this.setData({
                showAddModal: true,
                formData: {
                    poopDate: this.formatDate(now),
                    poopTime: this.formatTime(now),
                    poopType: "normal",
                    duration: 5,
                    feeling: "comfortable",
                    location: "home",
                    hasBlood: false,
                    color: "brown",
                    smell: "medium",
                    note: ""
                }
            });
        },

        // 关闭添加弹窗
        closeAddModal() {
            this.setData({
                showAddModal: false
            });
        },

        // 阻止触摸移动事件穿透到背景
        preventTouchMove(e) {
            return false;
        },

        // 阻止事件冒泡（用于内容区域）
        stopPropagation(e) {
            // 不做任何处理，只是阻止事件继续向上传播
            return true;
        },

        // 选择日期
        onDateChange(e) {
            this.setData({
                'formData.poopDate': e.detail.value
            });
        },

        // 选择时间
        onTimeChange(e) {
            this.setData({
                'formData.poopTime': e.detail.value
            });
        },

        // 选择便便类型
        selectPoopType(e) {
            const type = e.currentTarget.dataset.type;
            this.setData({
                'formData.poopType': type
            });
        },

        // 选择感觉
        selectFeeling(e) {
            const feeling = e.currentTarget.dataset.feeling;
            this.setData({
                'formData.feeling': feeling
            });
        },

        // 选择地点
        selectLocation(e) {
            const location = e.currentTarget.dataset.location;
            this.setData({
                'formData.location': location
            });
        },

        // 选择颜色
        selectColor(e) {
            const color = e.currentTarget.dataset.color;
            this.setData({
                'formData.color': color
            });
        },

        // 选择气味
        selectSmell(e) {
            const smell = e.currentTarget.dataset.smell;
            this.setData({
                'formData.smell': smell
            });
        },

        // 切换是否带血
        toggleBlood(e) {
            this.setData({
                'formData.hasBlood': e.detail.value
            });
        },

        // 调整时长
        onDurationChange(e) {
            this.setData({
                'formData.duration': parseInt(e.detail.value) || 0
            });
        },

        // 输入备注
        onNoteInput(e) {
            this.setData({
                'formData.note': e.detail.value
            });
        },

        // 提交表单
        async submitForm() {
            const { poopDate, poopTime, poopType, duration, feeling, location, hasBlood, color, smell, note } = this.data.formData;
            const userInfo = this.properties.userInfo;

            if (duration <= 0) {
                wx.showToast({
                    title: "请输入蹲坑时长",
                    icon: "none"
                });
                return;
            }

            wx.showLoading({ title: "保存中..." });

            try {
                const data = {
                    userId: userInfo._id,
                    userName: userInfo.username,
                    partnerId: userInfo.partnerId || null,
                    poopDate,
                    poopTime,
                    poopType,
                    duration,
                    feeling,
                    location,
                    hasBlood,
                    color,
                    smell,
                    note,
                    createTime: db.serverDate(),
                    updateTime: db.serverDate()
                };

                console.log('保存拉屎记录：', data);

                await db.collection("poop_records").add({
                    data
                });

                wx.hideLoading();
                wx.showToast({
                    title: "记录成功 💩",
                    icon: "success"
                });

                this.closeAddModal();
                this.loadPoops();
            } catch (error) {
                console.error("保存失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "保存失败",
                    icon: "none"
                });
            }
        },

        // 删除记录
        deletePoop(e) {
            const poop = e.currentTarget.dataset.poop;
            
            wx.showModal({
                title: "确认删除",
                content: `确定要删除这条记录吗？`,
                success: async (res) => {
                    if (res.confirm) {
                        await this.handleDelete(poop);
                    }
                }
            });
        },

        // 处理删除
        async handleDelete(poop) {
            wx.showLoading({ title: "删除中..." });

            try {
                await db.collection("poop_records").doc(poop._id).remove();

                wx.hideLoading();
                wx.showToast({
                    title: "删除成功",
                    icon: "success"
                });

                this.loadPoops();
            } catch (error) {
                console.error("删除失败：", error);
                wx.hideLoading();
                wx.showToast({
                    title: "删除失败",
                    icon: "none"
                });
            }
        },

        // 格式化日期
        formatDate(date) {
            const y = date.getFullYear();
            const m = `0${date.getMonth() + 1}`.slice(-2);
            const d = `0${date.getDate()}`.slice(-2);
            return `${y}-${m}-${d}`;
        },

        // 格式化时间
        formatTime(date) {
            const h = `0${date.getHours()}`.slice(-2);
            const m = `0${date.getMinutes()}`.slice(-2);
            return `${h}:${m}`;
        }
    }
});