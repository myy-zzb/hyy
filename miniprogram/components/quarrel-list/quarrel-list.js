// miniprogram/components/quarrel-list/quarrel-list.js
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
        quarrels: [],
        loading: false,
        showAddModal: false,
        showDetailModal: false,
        currentQuarrel: null,
        stats: {
            total: 0,
            reconciled: 0,
            unreconciled: 0
        },
        formData: {
            quarrelDate: "",
            quarrelTime: "",
            reason: "",
            hurtfulWords: "",
            myWords: "",
            severity: "medium",
            mood: "😢",
            note: ""
        },
        severityOptions: [
            { value: 'light', label: '小吵', color: '#52c41a', emoji: '😐' },
            { value: 'medium', label: '中等', color: '#faad14', emoji: '😠' },
            { value: 'serious', label: '严重', color: '#f5222d', emoji: '😡' }
        ],
        moodOptions: ['😢', '😭', '😤', '😡', '💔', '😔', '😞', '🥺']
    },

    observers: {
        'show': function(show) {
            if (show) {
                this.loadQuarrels();
            }
        }
    },

    methods: {
        // 加载吵架记录列表
        async loadQuarrels() {
            const userInfo = this.properties.userInfo;
            if (!userInfo) return;

            this.setData({ loading: true });

            try {
                const res = await db.collection("quarrels")
                    .where(db.command.or([
                        { userId: userInfo._id },
                        { partnerId: userInfo._id }
                    ]))
                    .orderBy('quarrelDate', 'desc')
                    .orderBy('quarrelTime', 'desc')
                    .get();

                console.log('查询到的吵架记录：', res.data);

                const quarrelsWithInfo = res.data.map(item => {
                    const severityInfo = this.data.severityOptions.find(s => s.value === item.severity) || this.data.severityOptions[1];
                    return {
                        ...item,
                        severityLabel: severityInfo.label,
                        severityColor: severityInfo.color,
                        severityEmoji: severityInfo.emoji
                    };
                });

                // 计算统计数据
                const stats = {
                    total: quarrelsWithInfo.length,
                    reconciled: quarrelsWithInfo.filter(q => q.isReconciled).length,
                    unreconciled: quarrelsWithInfo.filter(q => !q.isReconciled).length
                };

                this.setData({
                    quarrels: quarrelsWithInfo,
                    stats: stats,
                    loading: false
                });
            } catch (error) {
                console.error("加载吵架记录失败：", error);
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
                    quarrelDate: this.formatDate(now),
                    quarrelTime: this.formatTime(now),
                    reason: "",
                    hurtfulWords: "",
                    myWords: "",
                    severity: "medium",
                    mood: "😢",
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

        // 查看详情
        viewDetail(e) {
            const quarrel = e.currentTarget.dataset.quarrel;
            console.log('查看详情：', quarrel);
            this.setData({
                showDetailModal: true,
                currentQuarrel: quarrel
            });
        },

        // 关闭详情弹窗
        closeDetailModal() {
            this.setData({
                showDetailModal: false,
                currentQuarrel: null
            });
        },

        // 标记为和好
        async markAsReconciled() {
            const quarrel = this.data.currentQuarrel;
            if (!quarrel) return;

            try {
                await db.collection("quarrels").doc(quarrel._id).update({
                    data: {
                        isReconciled: true,
                        reconcileTime: db.serverDate(),
                        updateTime: db.serverDate()
                    }
                });

                wx.showToast({
                    title: "已标记和好 ❤️",
                    icon: "success"
                });

                this.closeDetailModal();
                this.loadQuarrels();
            } catch (error) {
                console.error("更新失败：", error);
                wx.showToast({
                    title: "操作失败",
                    icon: "none"
                });
            }
        },

        // 选择日期
        onDateChange(e) {
            this.setData({
                'formData.quarrelDate': e.detail.value
            });
        },

        // 选择时间
        onTimeChange(e) {
            this.setData({
                'formData.quarrelTime': e.detail.value
            });
        },

        // 输入原因
        onReasonInput(e) {
            this.setData({
                'formData.reason': e.detail.value
            });
        },

        // 输入对方说的话
        onHurtfulWordsInput(e) {
            this.setData({
                'formData.hurtfulWords': e.detail.value
            });
        },

        // 输入我说的话
        onMyWordsInput(e) {
            this.setData({
                'formData.myWords': e.detail.value
            });
        },

        // 选择严重程度
        selectSeverity(e) {
            const severity = e.currentTarget.dataset.severity;
            this.setData({
                'formData.severity': severity
            });
        },

        // 选择心情
        selectMood(e) {
            const mood = e.currentTarget.dataset.mood;
            this.setData({
                'formData.mood': mood
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
            const { quarrelDate, quarrelTime, reason, hurtfulWords, myWords, severity, mood, note } = this.data.formData;
            const userInfo = this.properties.userInfo;

            if (!reason) {
                wx.showToast({
                    title: "请输入吵架原因",
                    icon: "none"
                });
                return;
            }

            wx.showLoading({ title: "保存中..." });

            try {
                const data = {
                    userId: userInfo._id,
                    partnerId: userInfo.partnerId || null,
                    quarrelDate,
                    quarrelTime,
                    reason,
                    hurtfulWords,
                    myWords,
                    severity,
                    mood,
                    note,
                    isReconciled: false,
                    createdBy: userInfo._id,
                    createTime: db.serverDate(),
                    updateTime: db.serverDate()
                };

                console.log('保存吵架记录：', data);

                await db.collection("quarrels").add({
                    data
                });

                wx.hideLoading();
                wx.showToast({
                    title: "记录成功",
                    icon: "success"
                });

                this.closeAddModal();
                this.loadQuarrels();
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
        deleteQuarrel(e) {
            const quarrel = e.currentTarget.dataset.quarrel;
            
            wx.showModal({
                title: "确认删除",
                content: `确定要删除这条记录吗？`,
                success: async (res) => {
                    if (res.confirm) {
                        await this.handleDelete(quarrel);
                    }
                }
            });
        },

        // 处理删除
        async handleDelete(quarrel) {
            wx.showLoading({ title: "删除中..." });

            try {
                await db.collection("quarrels").doc(quarrel._id).remove();

                wx.hideLoading();
                wx.showToast({
                    title: "删除成功",
                    icon: "success"
                });

                this.loadQuarrels();
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