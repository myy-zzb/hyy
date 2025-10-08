// cloudfunctions/getTempFileURL/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const { fileList } = event
  
  try {
    const result = await cloud.getTempFileURL({
      fileList: fileList
    })
    
    return {
      success: true,
      fileList: result.fileList
    }
  } catch (error) {
    console.error('获取临时链接失败：', error)
    return {
      success: false,
      error: error
    }
  }
}