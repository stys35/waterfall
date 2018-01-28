(function () {
  let isLoading = false

  function eventEmitter() {
    this.sub = {}
  }

  eventEmitter.prototype.on = function(eventName, func) {
    if (this.sub[eventName]) { // 一种类型的事件只能绑定一个函数
      return
    }
    if (!this.sub[eventName]) {
      this.sub[eventName] = []
    }
    this.sub[eventName].push(func)
  }

  eventEmitter.prototype.emit = function(eventName) {
    const argsList = Array.prototype.slice.call(arguments, 1)
    for (let i = 0, length = this.sub[eventName].length; i < length; i++) {
      this.sub[eventName][i].apply(this, argsList)
    }
  }

  function Waterfall(options = {}) {
    eventEmitter.call(this)
    this.opts = {
      number: options.number,
      width: `${options.width || document.body.clientWidth || document.documentElement.clientWidth}px`,
      container: options.container || 'waterfall',
      resize: false,
    }
    options.width && Object.assign(this.opts, { tmpWidth: options.width })
    this.init(options) // 这个 this 是 new 的时候，绑上去的
    this.bind()
  }

  Waterfall.prototype = Object.create(eventEmitter.prototype)
  Waterfall.prototype.constructor = Waterfall

  const proto = Waterfall.prototype

  proto.compareOpts = function(options) {
    const self = this
    Object.keys(options).forEach((key) => {
      self.opts[key] = options[key]
    })
  }

  proto.init = function(options) {
    this.compareOpts(options)
    const $waterfall = document.getElementById(this.opts.container)
    $waterfall.style.width = this.opts.width
    const imgList = $waterfall.getElementsByTagName('img')
    if (this.opts.resize) {
      this.resize(imgList)
    }
    const perNum = this.getPerNum()
    const perList = [] // 存储第一列的各图片的高度
    for (let i = 0; i < perNum; i++) {
      perList.push(imgList[i].offsetHeight)
    }

    let pointer = this.getMinPointer(perList) || '0'

    for (let i = perNum; i < imgList.length; i++) {
      imgList[i].style.position = 'absolute' // 核心语句
      imgList[i].style.left = `${imgList[pointer].offsetLeft}px`
      imgList[i].style.top = `${perList[pointer]}px`

      perList[pointer] = perList[pointer] + imgList[i].offsetHeight // 数组最小的值加上相应图片的高度
      pointer = this.getMinPointer(perList)
    }
  }

  proto.getPerNum = function() {
    const $waterfall = document.getElementById(this.opts.container)
    const imgList = $waterfall.getElementsByTagName('img')
    const singleImgWidth = imgList[0].offsetWidth // 瀑布流默认每张图片宽度相等
    return Math.floor(parseInt(this.opts.width, 10) / singleImgWidth)
  }

  // 在 init 函数基础上的优化，触发 scroll 的时候，只对增加的部分渲染，这个函数想了比较久。大体思路首先找到最后一列的图片(注意不一定连续的)，并在高度最小的那个图片后面添加图片。
  proto.append = function() {
    const $waterfall = document.getElementById(this.opts.container)
    const imgList = $waterfall.getElementsByTagName('img')
    const length = imgList.length
    const perNum = this.getPerNum()
    const perList = [] // 存储最后一列的各图片的高度
    const currentPosition = length - this.opts.number // 要添加图片的起始坐标, +1 -1 抵消掉
    let count = 1
    const tmpObj = {}
    const tmpArr = [] // 存储 count 的值
    while (count < 100) {
      if (!tmpObj[imgList[currentPosition - count].offsetLeft] && tmpObj[imgList[currentPosition - count].offsetLeft] !== 0) {
        tmpObj[imgList[currentPosition - count].offsetLeft] = imgList[currentPosition - count].offsetLeft
        perList.push(imgList[currentPosition - count].offsetHeight + imgList[currentPosition - count].offsetTop)
        tmpArr.push(count)
        if (tmpArr.length === perNum) {
          break
        }
      }
      count++
    }

    let pointer = this.getMinPointer(perList) || 0

    for (let i = 0; i < this.opts.number; i++) {
      imgList[currentPosition + i].style.position = 'absolute'
      imgList[currentPosition + i].style.left = `${imgList[currentPosition - tmpArr[Number(pointer)]].offsetLeft}px`
      imgList[currentPosition + i].style.top = `${perList[pointer]}px`

      perList[pointer] = perList[pointer] + imgList[currentPosition + i].offsetHeight // 数组最小的值加上相应图片的高度
      pointer = this.getMinPointer(perList)
    }
  }

  proto.bind = function() {
    // 如果设置死了 width 的长度，则没必要绑定 resize
    if (!this.opts.tmpWidth) {
      util.addEventListener('resize', resize.bind(this))
    }
    util.addEventListener('scroll', scroll.bind(this))
  }

  // 获取最小高度的数组下标
  proto.getMinPointer = function(perList) {
    const minHeight = Math.min.apply(null, perList)
    for (let i in perList) {
      if (perList[i] === minHeight) {
        pointer = i
        return i
      }
    }
  }

  // 重置 position: absolute 防止 onresize 的时候产生干扰
  proto.resize = function(imgList) {
    for (let i = 0; i < imgList.length; i++) {
      imgList[i].style.position = 'static'
    }
    this.opts.resize = false
  }

  // 注册一次 done 事件，并触发
  proto.done = function() {
    const self = this
    this.on('done', function() {
      isLoading = false
      self.append()
    })
    this.emit('done')
  }

  const resize = function () {
    // 这个 this 是 bind 上去的
    this.init({
      resize: true,
      width: `${document.body.clientWidth || document.documentElement.clientWidth}px`,
    })
  }

  const scroll = function() {
    if (isLoading) return false // 避免一次触发事件多次
    const $waterfall = document.getElementById(this.opts.container)
    const imgList = $waterfall.getElementsByTagName('img')
    const scrollPX = document.body.scrollTop || document.documentElement.scrollTop
    const bsHeight = document.body.clientHeight || document.documentElement.clientHeight
    if (scrollPX + bsHeight > imgList[imgList.length - 1].offsetTop) { // 浏览器高度 + 滚动距离 < 最后一张图片的 offsetTop
      isLoading = true
      this.emit('load')
    }
  }

  const util = {
    addEventListener: function (evName, func) {
      window.addEventListener(evName, func, false)
    }
  }

  window.Waterfall = Waterfall
}())