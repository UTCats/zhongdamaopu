// 审核照片
import { regeneratorRuntime, randomInt, isManager } from '../../../utils.js';
import { sendNotice } from '../../../msg.js';

// 准备发送通知的列表，姓名：审核详情
var notice_list = {};

Page({

  /**
   * 页面的初始数据
   */
  data: {
    tipText: '正在鉴权...',
    tipBtn: false,
    total: '-',
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    notice_list = {};
    this.checkAuth();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    console.log('页面退出');

    // 自动数猫图
    wx.cloud.callFunction({
      name: "countPhoto",
      success: (res) => {
        console.log('数猫图完成', res.result);
      }
    });
    
    // 发送审核消息
    sendNotice(notice_list);
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },
  // 没有权限，返回上一页
  goBack() {
    wx.navigateBack();
  },
  // 检查权限
  checkAuth() {
    const that = this;
    isManager(function(res) {
      if (res) {
        that.setData({
          auth: true
        });
        that.reload();
      } else {
        that.setData({
          tipText: '只有管理员能进入嗷',
          tipBtn: true,
        });
        console.log("Not a manager.");
      }
    })
  },
  async loadPhotos() {
    const db = wx.cloud.database();
    var photos = (await db.collection('photo').where({ verified: false }).get()).data;
    for (var ph of photos) {
      var cat = (await db.collection('cat').doc(ph.cat_id).get()).data;
      ph.cat = cat
    }
    console.log(photos);
    this.setData({
      photos: photos
    });
    return true;
  },

  reload() {
    wx.showLoading({
      title: '加载中...',
    });
    const that = this;
    const db = wx.cloud.database();
    db.collection('photo').where({ verified: false }).count().then(res => {
      console.log(res);
      that.setData({
        total: res.total
      });
      that.loadPhotos().then(() => {
        wx.hideLoading();
      });
    });
  },

  bindCheck(e) {
    const photo = e.currentTarget.dataset.photo;
    const best = e.currentTarget.dataset.best;
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定通过审核' + (best ? '+精选' : '') + '？',
      success(res) {
        if (res.confirm) {
          console.log('开始通过');
          wx.cloud.callFunction({
            name: "managePhoto",
            data: {
              type: "check",
              photo: photo,
              best: best
            }
          }).then(res => {
            console.log("审核通过：" + photo._id);
            console.log(res.data);
            // 内存记录一下这个操作，用来发通知
            that.addNotice(photo, true);

            // 直接从列表里去掉这只猫，不完全加载了
            const photos = that.data.photos;
            const new_photos = photos.filter((ph, index, arr) => {
              // 这个photo是用户点击的photo，在上面定义的
              return ph._id != photo._id;
            });
            that.setData({
              photos: new_photos,
              total: that.data.total - 1
            }, () => {
              wx.showToast({
                title: '审核通过',
              });
            });
            
          })
        }
      }
    })
  },

  bindDelete(e) {
    const photo = e.currentTarget.dataset.photo;
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定删除？',
      success(res) {
        if (res.confirm) {
          console.log('开始删除');
          wx.cloud.callFunction({
            name: "managePhoto",
            data: {
              type: "delete",
              photo: photo
            }
          }).then(res => {
            console.log("删除照片记录：" + photo._id);
            // 内存记录一下这个操作，用来发通知
            that.addNotice(photo, false);

            // 直接从列表里去掉这只猫，不完全加载了
            const photos = that.data.photos;
            const new_photos = photos.filter((ph, index, arr) => {
              // 这个photo是用户点击的photo，在上面定义的
              return ph._id != photo._id;
            });
            that.setData({
              photos: new_photos,
              total: that.data.total - 1
            }, () => {
              wx.showToast({
                title: '删除成功',
              });
            });
          })
        }
      }
    })
  },
  openBigPhoto(e) {
    const pid = e.currentTarget.dataset.pid;
    wx.previewImage({
      urls: [pid]
    });
  },

  // 添加一条通知记录，等页面退出的时候统一发送通知
  addNotice(photo, accepted) {
    const openid = photo._openid;
    if (!notice_list[openid]) {
      notice_list[openid] = {
        accepted: 0,
        deleted: 0,
      }
    }
    if(accepted) {
      notice_list[openid].accepted ++;
    } else {
      notice_list[openid].deleted ++;
    }
  }
})