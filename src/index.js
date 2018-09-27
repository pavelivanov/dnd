const closest = (el, fn) => {
  while (el) {
    if (fn(el)) {
      return el
    }
    el = el.parentNode
  }
}

const getCursorPosition = (event) => ({
  x: event.touches ? event.touches[0].clientX : event.clientX,
  y: event.touches ? event.touches[0].clientY : event.clientY,
})

const vendorPrefix = (function() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '' // server environment
  // fix for:
  //    https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  //    window.getComputedStyle() returns null inside an iframe with display: none
  // in this case return an array with a fake mozilla style in it.
  const styles = window.getComputedStyle(document.documentElement, '') || ['-moz-hidden-iframe']
  const pre = (Array.prototype.slice.call(styles).join('').match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o']))[1]

  switch (pre) {
    case 'ms':
      return 'ms'
    default:
      return pre && pre.length ? pre[0].toUpperCase() + pre.substr(1) : ''
  }
})()

const arrayMove = (arr, oldIndex, newIndex) => {
  if (newIndex >= arr.length) {
    let k = newIndex - arr.length + 1

    while (k--) {
      arr.push(undefined)
    }
  }

  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0])

  return arr
}

const insertBefore = (referenceNode, newNode) =>
  referenceNode.parentNode.insertBefore(newNode, referenceNode)

const insertAfter = (referenceNode, newNode) =>
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)

const eventNames = {
  start: [ 'touchstart', 'mousedown' ],
  move: [ 'touchmove', 'mousemove' ],
  end: [ 'touchend', 'touchcancel', 'mouseup' ],
}


class DND {

  /**
   *
   * @param node
   * @param options {object}
   * @param options.itemSelector {string} - item class
   * @param options.itemFilter {function} - filter items
   */
  constructor(node, options) {
    this.node     = node
    this.opts     = options
    this.items    = []

    this.activeNode = null
    this.initialTouchCursorPosition = null
    this.helper = null

    this.handlers = {
      start: this.handleTouchStart,
      move: this.handleMove,
      end: this.handleTouchEnd,
    }

    this.getItems()
    this.bindListeners()
  }

  getItems() {
    const nodes = this.node.getElementsByClassName(this.opts.itemSelector)

    this.items = []

    ;[].forEach.call(nodes, (node) => {
      this.items.push(node)
    })
  }

  filterItems() {
    return this.items.filter(this.opts.itemFilter)
  }

  getNodeIndex(nodes, node) {
    return nodes.findIndex((item) => item === node)
  }

  bindListeners() {
    Object.keys(eventNames).forEach((key) => {
      eventNames[key].forEach((eventName) => {
        document.addEventListener(eventName, this.handlers[key])
      })
    })

    eventNames.move.forEach((eventName) => {
      this.node.addEventListener(eventName, this.handleSort, false)
    })
  }

  createHelper(event) {
    this.helper = this.activeNode.cloneNode(true)
    const bounds = this.activeNode.getBoundingClientRect()

    this.helper.style.position      = 'fixed'
    this.helper.style.top           = `${bounds.top}px`
    this.helper.style.left          = `${bounds.left}px`
    this.helper.style.width         = `${bounds.width}px`
    this.helper.style.height        = `${bounds.height}px`
    this.helper.style.boxSizing     = 'border-box'
    this.helper.style.pointerEvents = 'none'
    this.helper.style.zIndex        = 600

    this.activeNode.style.visibility  = 'hidden'
    this.activeNode.opacity           = 0

    this.initialTouchCursorPosition = getCursorPosition(event)

    document.body.appendChild(this.helper)
  }

  handleTouchStart = () => {
    const node = closest(event.target, (node) => (
      node.classList
      && node.classList.contains(this.opts.itemSelector)
      && this.opts.itemFilter(node)
    ))

    const nodeFromItems = this.items.includes(node)

    if (!node || !nodeFromItems) {
      return
    }

    this.activeNode = node

    this.filterItems().forEach((node) => {
      node.initialBounds = node.getBoundingClientRect()
    })
  }

  updateHelperPosition(event) {
    const offset = getCursorPosition(event)

    const translate = {
      x: offset.x - this.initialTouchCursorPosition.x,
      y: offset.y - this.initialTouchCursorPosition.y,
    }

    this.helper.style[`${vendorPrefix}Transform`] = `translate3d(${translate.x}px, ${translate.y}px, 0)`
  }

  getInitialIndex(nodes) {
    return this.getNodeIndex(nodes, this.activeNode)
  }

  getHoveredIndex(nodes) {
    const helperBounds  = this.helper.getBoundingClientRect()
    let hoveredIndex

    nodes.forEach((node, index) => {
      if (!this.opts.itemFilter(node)) {
        return
      }

      const bounds = node.initialBounds

      const hovered = helperBounds.left > bounds.left - bounds.width / 2
        && helperBounds.left < bounds.left + bounds.width / 2
        && helperBounds.top > bounds.top - bounds.height / 2
        && helperBounds.top < bounds.top + bounds.height / 2

      if (hovered) {
        hoveredIndex = index
      }
    })

    return hoveredIndex
  }

  updateNodesPosition() {
    const nodes         = this.filterItems()
    const initialIndex  = this.getInitialIndex(nodes)
    const hoveredIndex  = this.getHoveredIndex(nodes)

    // if no one node is hovered then return to not lose translates
    if (hoveredIndex === null) {
      return
    }

    const delta     = hoveredIndex - initialIndex > 0 ? 1 : -1
    const lowIndex  = delta > 0 ? initialIndex : hoveredIndex
    const highIndex = delta > 0 ? hoveredIndex : initialIndex

    nodes.forEach((node, index) => {
      let transformValue

      if (
        delta > 0 && index > lowIndex && index <= highIndex
        || delta < 0 && index >= lowIndex && index < highIndex
      ) {
        const nodeBounds          = node.initialBounds
        const index               = this.getNodeIndex(nodes, node)
        const closestNodeBounds   = nodes[index - delta].initialBounds

        const translate = {
          x: closestNodeBounds.left - nodeBounds.left,
          y: closestNodeBounds.top - nodeBounds.top,
        }

        transformValue = `translate3d(${translate.x}px, ${translate.y}px, 0)`
      }
      else {
        transformValue = `translate3d(0, 0, 0)`
      }

      node.style[`${vendorPrefix}TransitionDuration`] = `${300}ms`
      node.style[`${vendorPrefix}Transform`] = transformValue
    })
  }

  handleMove = (event) => {
    event.preventDefault()

    if (!this.activeNode) {
      return
    }

    if (!this.helper) {
      this.createHelper(event)
    }

    this.updateHelperPosition(event)
  }

  handleSort = () => {
    if (!this.activeNode || !this.helper) {
      return
    }

    this.updateNodesPosition()
  }

  clearIfNotMoved() {
    this.activeNode.style.visibility  = ''
    this.activeNode.style.opacity     = ''

    this.activeNode = null
    this.helper = null
  }

  clear() {
    this.items.forEach((node) => {
      node.style[`${vendorPrefix}TransitionDuration`] = ''
      node.style[`${vendorPrefix}Transform`] = ''
    })

    this.items = []

    this.helper.parentNode.removeChild(this.helper)

    this.clearIfNotMoved()
  }

  handleTouchEnd = () => {
    if (!this.activeNode) {
      return
    }

    const initialIndex  = this.getInitialIndex(this.items)
    const hoveredIndex  = this.getHoveredIndex(this.items)

    // if item not moved to other cell
    // or it was moved but not hovered any other item
    // or it was moved and returned back to it's initial place
    if (
      !this.helper
      || hoveredIndex === null
      || initialIndex === hoveredIndex
    ) {
      this.clearIfNotMoved()
      return
    }

    const delta     = hoveredIndex - initialIndex > 0 ? 1 : -1
    const lowIndex  = delta > 0 ? initialIndex : hoveredIndex
    const highIndex = delta > 0 ? hoveredIndex : initialIndex

    // [ 1, 2, 3*, 4*, 5, 6, 7 ]  move 2 to 6
    if (delta > 0) {

      // [ 1, 3*, 4*, 5, 6, 2, 7 ]
      insertAfter(this.items[hoveredIndex], this.activeNode)

      /*

        Need to move all disabled items to the right for 1 index

        [ 1, 5, 3*, 4*, 6, 2, 7 ]

        starting from highIndex (here it's number 6) going to the left check each node if it's disabled
        if item is not disabled then pass it
        if item is disabled then move to the right for 1 index

       */

      for (let i = highIndex; i > lowIndex; i--) {
        const movingNode = this.items[i]

        // if disabled item
        if (!this.opts.itemFilter(movingNode)) {

          // insert disabled item after next element
          insertAfter(this.items[i + 1], movingNode)

          // reload items - insert item after next item
          this.items = arrayMove(this.items, i + 1, i)
        }
      }
    }

    // [ 1, 2, 3*, 4*, 5, 6, 7 ]  move 6 to 2
    else {

      // [ 1, 6, 2, 3*, 4*, 5, 7 ]
      insertBefore(this.items[hoveredIndex], this.activeNode)

      /*

       Need to move all disabled items to the left for 1 index

       [ 1, 6, 3*, 4*, 2, 5, 7 ]

       starting from lowIndex (here it's number 6) going to the right check each node if it's disabled
       if item is not disabled then pass it
       if item is disabled then move to the left for 1 index

       */

      for (let i = lowIndex; i < highIndex; i++) {
        const movingNode = this.items[i]

        // if disabled item
        if (!this.opts.itemFilter(movingNode)) {

          // insert disabled item before prev element
          insertBefore(this.items[i - 1], movingNode)

          // reload items - insert item before prev item
          this.items = arrayMove(this.items, i - 1, i)
        }
      }
    }

    this.clear()
    this.getItems()
  }
}


export default DND
