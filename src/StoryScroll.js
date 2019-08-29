import * as PIXI from 'pixi.js';
import * as browser from "judgebrowser"
import Math from 'mathjs'
import {TweenMax} from "gsap/TweenMax";
import Scroller from './Scroller';

class StoryScroll {
	designWidth;
	designLength;
	// abstractContentWidth = 0;	// Scaled Design With
	// abstractContentLength = 0;	// Scaled Design Length
	abstractViewWidth = 0;		// First View Width = Content Width (No Crop)
	abstractViewLength = 0;		// First View Length = abstractDeviceLength/(abstractDeviceWidth/designWidth)
	abstractDeviceWidth = 0;
	abstractDeviceLength = 0;
	abstractMaxScroll = 0;
	storyPosition = 0;

	constructor(o) {
		this._defaultSetting(o);
		this._createContainer(o);
		window.onresize = e => this._windowResize();
		this._windowResize();
	}

	chapter(o, _parent) {
		let chapter = new PIXI.Container();
		this._setProps(chapter, o);
		chapter.sprite = (imgsrc, o) => this.sprite(imgsrc, o, chapter);
		chapter.spriteAnimated = (imgsrcs, o, autoPlay) => this.spriteAnimated(imgsrcs, o, autoPlay, chapter);
		chapter.graphic = (o) => this.graphic(o, chapter);
		chapter.chapter = (o) => this.chapter(o, chapter);
		this._setActions(chapter);
		if (_parent) _parent.addChild(chapter);
		else this.containerScroll.addChild(chapter);
		return chapter; 
	}

	sprite(imgsrc, o, _parent) {
		let sprite = this._createSprite(imgsrc, o);
		this._setActions(sprite);
		if (_parent) _parent.addChild(sprite);
		else this.containerScroll.addChild(sprite);
		return sprite;
	};
	_createSprite(imgsrc, opt){
        var newSprite = new PIXI.Sprite.from(imgsrc);
        this._setProps(newSprite, opt);
		// this.loaderList.push(imgsrc);
        return newSprite;
	}

	spriteAnimated(imgsrcs, o, autoPlay, _parent) {
		let sprite = this._createAnimatedSprite(imgsrcs, o, autoPlay);
		this._setActions(sprite);
		if (_parent) _parent.addChild(sprite);
		else this.containerScroll.addChild(sprite);
		if (autoPlay !== false) sprite.play();
		return sprite;
	}
	_createAnimatedSprite(imgsrcs, o, autoPlay) {
		let textures = [];
		let AnimatedSpriteInstance = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY]);
		if (typeof imgsrcs == 'object' && imgsrcs.length > 0) {
			imgsrcs.forEach(imgsrc => {
				textures.push(PIXI.Texture.from(imgsrc));
			});
			AnimatedSpriteInstance.textures = textures;
		} else {
			this.app.loader
			.add('spritesheet', imgsrcs)
			.load((loader, resources) => {
				for (const imgkey in resources.spritesheet.data.frames) {
					const texture = PIXI.Texture.from(imgkey);
					const time = resources.spritesheet.data.frames[imgkey].duration;
					textures.push(time? {texture, time} : texture);
				}
				AnimatedSpriteInstance.textures = textures;
				if (autoPlay !== false) AnimatedSpriteInstance.play();
			});
		}
		this._setProps(AnimatedSpriteInstance, o);
		return AnimatedSpriteInstance;
	}
	_setProps(sprite, props) {
		if (props) {
            for (const prop in props) {
                if (props.hasOwnProperty(prop)) {
                    sprite[prop] = props[prop];
                }
            }
		}
		return sprite;
	}

	graphic(o, _parent) {
		let graphic = new PIXI.Graphics();
        this._setProps(graphic, o);
		this._setActions(graphic);
		if (_parent) _parent.addChild(graphic);
		else this.containerScroll.addChild(graphic);
		return graphic;
	}
	
	_setActions(obj) {
		const Self = this;
		obj.act = (props, duration, triggerPosition) => Self.act(obj, props, duration, triggerPosition);
		obj.actByStep = (props, section, triggerPosition) => Self.actByStep(obj, props, section, triggerPosition);
		obj.setPin = (triggerPosition, section) => Self.setPin(obj, triggerPosition, section);
	}

	act(obj, props, duration, triggerPosition) {
		if (triggerPosition === undefined) triggerPosition = this._getSpriteTriggerPosition(obj);
		if (!obj.actions) obj.actions = {};
		let hash = this._createHash(8);
		obj.actions[hash] = {action: {type:'point', props, duration, triggerPosition}};
		this.actions.push({sprite:obj, hash, ...obj.actions[hash].action});
		return obj;
	}
	actByStep(obj, props, section, triggerPosition) {
		if (triggerPosition === undefined) triggerPosition = this._getSpriteTriggerPosition(obj);
		if (!obj.actions) obj.actions = {};
		let hash = this._createHash(8);
		obj.actions[hash] = {action: {type:'section', props, section, triggerPosition}};
		this.actions.push({sprite:obj, hash, ...obj.actions[hash].action});
		return obj;
	}
	setPin(obj, triggerPosition, section) {
		if (section === undefined) section = this.maxScroll;
		let props = this.scrollDirection == 'x' ? {x: obj.x + section } : {y: obj.y + section };
		obj.actByStep(props, section, triggerPosition)
		return obj;
	}
	
	_defaultSetting(o) {
		this.crop = o.crop || 'longside';	// false, none,longside,shortside
		this.cropOrigin = o.cropOrigin || 'top';	// center, top,bottom, left,right
		// this.designOrientation = o.orientation || 'portrait';	// 设计稿横竖屏: portrait, landscape
		this.scrollDirection = o.direction || 'y';
		this.designWidth = o.width || 750;
		this.designLength = o.length || 10000;
		this.actionList = [];
		this.actions = [];

		// init
		this._clientWidth = document.documentElement.clientWidth || window.innerWidth;
		this._clientHeight = document.documentElement.clientHeight || window.innerHeight;
		this.deviceOrientation = this._clientWidth < this._clientHeight ? 'portrait' : 'landscape';	// 当前设备横竖屏
		this.designOrientation = this.scrollDirection == 'y' ? 'portrait' : 'landscape'
		this.loaderList = [];
this.maxScroll = this.designLength - this._clientWidth
		
		this.scroller = new Scroller((left, top, zoom) => this._scrollerCallback(left, top, zoom), {
			zooming: false,
			animating: true,
			bouncing: false,
			animationDuration: 1000
		});
		this.scroller.__enableScrollY = true;
		this.scrollPosition = 0;

		let mousedown = false;
		document.addEventListener("touchstart", (e) => {
			this.scroller.doTouchStart(e.touches, e.timeStamp);
			mousedown = true;
		}, false);

		document.addEventListener("touchmove", (e) => {
			if (!mousedown) {
				return;
			}
			this.scroller.doTouchMove(e.touches, e.timeStamp);
			mousedown = true;
		}, false);

		document.addEventListener("touchend", (e) => {
			if (!mousedown) {
				return;
			}
			this.scroller.doTouchEnd(e.timeStamp);
			mousedown = false;
		}, false);
	};

	_createContainer(o) {
		this.app = new PIXI.Application( {width: this._clientWidth, height: this._clientHeight, backgroundColor : o.backgroundColor, antialias: true});
		const main = document.body.appendChild(document.createElement('main'));
		main.appendChild(this.app.view);

		this.containerFitWindow = new PIXI.Container();
		this.containerFitWindow.pivot.set(0, 0);
		this.containerScroll = new PIXI.Container();
		this.containerScroll.name = 'story';
		this.containerFitWindow.addChild(this.containerScroll);
		this.app.stage.addChild(this.containerFitWindow);
	}
	
	_scrollerCallback(left, top, zoom){
		// console.log('top:', top)
		// console.log('left:', left)

this.scrollPosition = this._getSrollPosition(left, top);
		this.storyPosition = this._getSrollPosition(left, top);
		setPosition.call(this, this.containerScroll, this.storyPosition);


if (this.scrollDirection == 'x') {
	// this.containerScroll.x = -this.scrollPosition / this._scale;
	this.scrollPosition = this.scrollPosition / this._scale;
} else {
	// this.containerScroll.y = -this.scrollPosition / this._scale;
	this.scrollPosition = this.scrollPosition / this._scale;
}
console.log('scrollPosition :', this.scrollPosition );
		console.log('scrollPosition :', this.scrollPosition );

		// Act
		this.actions.forEach(action => {
			if (action.type == 'point') {
				triggerActionByPosition.call(this, action);
			} else if (action.type == 'section') {
				triggerActionByStep.call(this, action);
			} else if(action.type == 'pin') {
				triggerActionSetPin.call(this, action);
			}
		});

		function setPosition(body, storyPosition) {
			if (this.direction == 'x') {
				body.x = -storyPosition / this._scale;
			} else {
				body.y = -storyPosition / this._scale;
			}
		}

		function triggerActionByPosition(action) {
			let storedAction = action.sprite.actions[action.hash];
			if (this.scrollPosition > action.triggerPosition) {
				if (storedAction.status != 'acting' && storedAction.status != 'done') {
					action.props.onComplete = el => storedAction.status = 'done';
					action.props.onReverseComplete = el => storedAction.status = 'reversed';
					let tweenInstance = TweenMax.to(action.sprite, action.duration, action.props);
					_setActStatus(action.sprite, action.hash, tweenInstance);
				}
			} else {
				// 倒带
				if (storedAction.status == 'acting' || storedAction.status == 'done') {
					if (storedAction.tween) {
						storedAction.status = 'reversing';
						storedAction.tween.reverse();
					}
				}
			}
		}
		function _setActStatus(sprite, hash, tweenInstance) {
			sprite.actions[hash].tween = tweenInstance;
			sprite.actions[hash].status = 'acting';
		}
		function triggerActionByStep(action) {
			// if ( action.triggerPosition < this.scrollPosition && this.scrollPosition < action.triggerPosition + action.section) {
			action.sprite._originProps = action.sprite._originProps || {};
			for (var prop in action.props) {
				if (typeof action.props[prop] == 'object') {
					for (var subprop in action.props[prop]) {
						if (!action.sprite._originProps[prop]) action.sprite._originProps[prop] = {};
						if (!action.sprite._originProps[prop][subprop]) action.sprite._originProps[prop][subprop] = action.sprite[prop][subprop];
						if ( action.triggerPosition < this.scrollPosition && this.scrollPosition < action.triggerPosition + action.section) {
							action.sprite[prop][subprop] = this._scrollNum(action.triggerPosition, action.triggerPosition + action.section, this.scrollPosition, action.sprite._originProps[prop][subprop], action.props[prop][subprop]);
						}else if(action.triggerPosition >= this.scrollPosition){
							action.sprite[prop][subprop] = action.sprite._originProps[prop][subprop];
						}else if(this.scrollPosition >= action.triggerPosition + action.section){
							action.sprite[prop][subprop] = action.props[prop][subprop];
						}
					}
				} else {
					if (!action.sprite._originProps[prop]) action.sprite._originProps[prop] = action.sprite[prop];
					if ( action.triggerPosition < this.scrollPosition && this.scrollPosition < action.triggerPosition + action.section) {
						action.sprite[prop] = this._scrollNum(action.triggerPosition, action.triggerPosition + action.section, this.scrollPosition, action.sprite._originProps[prop], action.props[prop]);
					}else if(action.triggerPosition >= this.scrollPosition){
						action.sprite[prop] = action.sprite._originProps[prop];
					}else if(this.scrollPosition >= action.triggerPosition + action.section){
						action.sprite[prop] = action.props[prop];
					}
				}
			}
			// } 
			// else{
			 	// if (this.scrollPosition >= action.triggerPosition + action.section) {
				// 强制达到最终态
				// if > position => props = ending, else < p => props = start
				// for (var prop in action.props) {
				// 	if (typeof action.props[prop] == 'object') {
				// 		for (var subprop in action.props[prop]) {
				// 			if (this.scrollPosition >= action.triggerPosition + action.section) {
				// 				action.sprite[prop][subprop] =  action.props[prop][subprop];
				// 			}else if(this.scrollPosition <= action.triggerPosition){
				// 				action.sprite[prop][subprop] =  action.sprite._originProps[prop][subprop];
				// 			}
				// 		}
				// 	} else {
				// 		if (!action.sprite._originProps[prop])
				// 		if (this.scrollPosition >= action.triggerPosition + action.section) {
				// 			action.sprite[prop][subprop] =  action.props[prop];
				// 		}else if(this.scrollPosition <= action.triggerPosition){
				// 			action.sprite[prop][subprop] = action.sprite._originProps[prop];
				// 		}
				// 		action.sprite[prop] = action.props[prop];
				// 	}
				// }
			// }
		}
	}

	// 区间最小值, 区间最大值, top, 初始位置, 终点, 速度, 方向
	_scrollNum(minNum,maxNum,top,start,end) {
		return start + ((top - minNum)/(maxNum - minNum)*(end-start));
	}

	_getSpriteTriggerPosition(sprite) {
		let spritePosition = this.scrollDirection == 'x' ? sprite.x : sprite.y;
		if (sprite.parent && sprite.parent.name != 'story') return spritePosition + this._getSpriteTriggerPosition(sprite.parent);
		return spritePosition - this.pageHeight * 2/3;
	}

	_createHash (hashLength) {
		return Array.from(Array(Number(hashLength) || 24), () => Math.floor(Math.random() * 36).toString(36)).join('');
	}

	/* deprecated
	_getSrollPosition(left, top) {
		if (this.designOrientation == 'portrait') {
			if (this.deviceOrientation == 'portrait') {
				if (this.scrollDirection == 'x') {
					return left;
				} else {
					return top;
				}
			} else {
				if (this.scrollDirection == 'x') {
					return top;
				} else {
					return left;
				}
			}
		} else {
			if (this.deviceOrientation == 'portrait') {
				if (this.scrollDirection == 'x') {
					return top;
				} else {
					return left;
				}
			} else {
				if (this.scrollDirection == 'x') {
					return left;
				} else {
					return top;
				}
			}
		}
	} */
	_getSrollPosition(left, top) {
		let positionMapFunctionGenerator = (left, top) => {
			let positionMap = {
				'design_portrait': {
					'device_portrait': {
						'x': left,
						'y': top
					},
					'device_landscape': {
						'x': top,
						'y': left
					}
				},
				'design_landscape': {
					'device_portrait': {
						'x': top,
						'y': left
					},
					'device_landscape': {
						'x': left,
						'y': top
					}
				}
			}
			return (designOrientation, deviceOrientation, scrollDirection) => {
				return positionMap ['design_'+designOrientation] ['device_'+deviceOrientation] [scrollDirection];
			};
		}

		const getPositionFromMap = positionMapFunctionGenerator(left, top);
		return getPositionFromMap(this.designOrientation, this.deviceOrientation, this.scrollDirection);
	}
	
	_windowResize() {
		this._clientWidth = document.documentElement.clientWidth || window.innerWidth;
		this._clientHeight = document.documentElement.clientHeight || window.innerHeight;
		
		this.deviceOrientation = this._clientWidth < this._clientHeight ? 'portrait' : 'landscape';
		this.abstractDeviceWidth = this.deviceOrientation == 'portrait' ? this._clientWidth : this._clientHeight;
		this.abstractDeviceWidth = this.deviceOrientation == 'portrait' ? this._clientWidth : this._clientHeight;

		this._scale = this.abstractDeviceWidth / this.designWidth;
		this.abstractMaxScroll = this.designWidth - this.abstractDeviceLength

		this.abstractViewWidth = this.designWidth;
		this.abstractViewLength = this.abstractDeviceLength / this._scale;

		this.containerFitWindow.rotation = getContainerRotation(this.designOrientation, this.deviceOrientation);
		this.containerFitWindow.scale.set(this._scale, this._scale);
		this.app.renderer.resize(this._clientWidth, this._clientHeight);

		function getContainerRotation(designOrientation, deviceOrientation) {
			const rotationMap = {
				design_portrait: {
					device_portrait: 0,
					device_landscape: - Math.PI / 2
				},
				design_landscape: {
					device_portrait: Math.PI / 2,
					device_landscape: 0
				}
			}
			return rotationMap[ 'design_'+designOrientation ] [ 'device_'+deviceOrientation ];
		}

		if(browser.weixin){
			if(this.designOrientation == 'portrait'){
				if(window.orientation === 90 || window.orientation === -90){
					// 横屏 浏览器的宽度大于高度
					this._viewPortraitDeviceL();
				} else if (window.orientation === 180 || window.orientation === 0){
					// 竖屏 浏览器的宽度小于高度
					this._viewPortraitDeviceP();
				}
			}else{
				if(window.orientation === 90 || window.orientation === -90){
					// 横屏 浏览器的宽度大于高度
					this._viewLandscapDeviceL();
				} else if (window.orientation === 180 || window.orientation === 0){
					// 竖屏 浏览器的宽度小于高度
					this._viewLandscapDeviceP();
				}
			}
			
		}else{
			// console.log("width"+this._clientWidth +"height"+this._clientHeight)
			if(this.designOrientation == 'portrait'){
				if (this.deviceOrientation == 'portrait') {
					this._viewPortraitDeviceP();
				} else {
					this._viewPortraitDeviceL();
				}
			}else{
				if (this.deviceOrientation == 'portrait') {
					this._viewLandscapDeviceP();
				} else {
					this._viewLandscapDeviceL();
				}
			}
		}
	}
	
	// 视图横屏 设备横屏
	_viewLandscapDeviceL(){
		this._scale = this._clientHeight / this.designWidth;
		this.pageHeight= this._clientWidth / this._scale;
		this.containerFitWindow.rotation = 0;
		this.containerFitWindow.scale.set(this._scale, this._scale);
		this.app.renderer.resize(this._clientWidth, this._clientHeight);
		switch (this.cropOrigin) {
			case 'center':
				this.containerFitWindow.position.set(0, (this._clientWidth - this.maxScroll)/2);
				break;
			case 'right':
				this.containerFitWindow.position.set(0, this._clientWidth - this.maxScroll);
				break;
			case 'left':
			default:
				this.containerFitWindow.position.set(0, 0);
				break;
		}

		setTimeout(() => {
			if(this.scrollDirection == 'x'){
				this.scroller.setDimensions(this._clientWidth, this._clientHeight, this.maxScroll + this._clientWidth, this._clientHeight);
				this.scroller.scrollTo(this.scrollPosition * this._scale, 0, false);
			}else{
				this.scroller.setDimensions(this._clientWidth, this._clientHeight, this._clientWidth, this.maxScroll + this._clientHeight);
				this.scroller.scrollTo(0, this.scrollPosition * this._scale, false);
			}
		},200)
	}
	// 视图横屏 设备竖屏 
	_viewLandscapDeviceP(){
		this._scale = this._clientWidth / this.designWidth;
		this.pageHeight= this._clientHeight / this._scale;
		this.containerFitWindow.rotation = Math.PI / 2;
		this.containerFitWindow.scale.set(this._scale, this._scale);
		this.app.renderer.resize(this._clientWidth, this._clientHeight);
		switch (this.cropOrigin) {
			case 'center':
				this.containerFitWindow.position.set(this._clientWidth, (this._clientHeight - this.maxScroll)/2);
				break;
			case 'bottom':
				this.containerFitWindow.position.set(this._clientWidth, this._clientHeight - this.maxScroll);
				break;
			case 'top':
			default:
				this.containerFitWindow.position.set(this._clientWidth, 0);
				break;
		}

		setTimeout(() => {
			if(this.scrollDirection == 'x'){
				this.scroller.setDimensions(this._clientWidth, this._clientHeight,  this._clientWidth, this.maxScroll + this._clientHeight);
				this.scroller.scrollTo(this.scrollPosition * this._scale, 0, false);
			}else{
				this.scroller.setDimensions(this._clientWidth, this._clientHeight,  this.maxScroll + this._clientWidth, this._clientHeight);
				this.scroller.scrollTo(this.scrollPosition * this._scale, 0, false);
			}
		},200)
		
	}
	// 视图竖屏 设备竖屏 
	_viewPortraitDeviceP(){
		// this._scale = this._clientHeight / this.designWidth;
		// this.pageHeight= this._clientWidth / this._scale;
		// this.containerFitWindow.rotation = 0;
		// this.containerFitWindow.scale.set(this._scale, this._scale);
		// this.app.renderer.resize(this._clientWidth, this._clientHeight);
		switch (this.cropOrigin) {
			case 'center':
				this.containerFitWindow.position.set(0, (this._clientWidth - this.maxScroll)/2);
				break;
			case 'bottom':
				this.containerFitWindow.position.set(0, this._clientWidth - this.maxScroll);
				break;
			case 'top':
			default:
				this.containerFitWindow.position.set(0, 0);
				break;
		}

		setTimeout(() => {
			if(this.scrollDirection == 'x'){
				this.scroller.setDimensions(this._clientWidth, this._clientHeight, this.maxScroll + this._clientWidth, this._clientHeight);
				this.scroller.scrollTo(this.scrollPosition * this._scale, 0, false);
			}else{
				this.scroller.setDimensions(this._clientWidth, this._clientHeight, this._clientWidth, this.maxScroll + this._clientHeight);
				this.scroller.scrollTo(0, this.scrollPosition * this._scale, false);
			}
		},200)
	}
	// 视图竖屏 设备横屏 
	_viewPortraitDeviceL(){
		// this._scale = this._clientWidth / this.designWidth;
		// this.pageHeight= this._clientHeight / this._scale;
		// this.containerFitWindow.rotation = - Math.PI / 2;
		// this.containerFitWindow.scale.set(this._scale, this._scale);
		// this.app.renderer.resize(this._clientWidth, this._clientHeight);
		switch (this.cropOrigin) {
			case 'center':
				this.containerFitWindow.position.set((this._clientWidth - this.maxScroll)/2, this._clientHeight);
				break;
			case 'bottom':
				this.containerFitWindow.position.set(this._clientWidth - this.maxScroll, this._clientHeight);
				break;
			case 'top':
			default:
				this.containerFitWindow.position.set(0, this._clientHeight);
				break;
		}

		setTimeout(() => {
			if(this.scrollDirection == 'x'){
				this.scroller.setDimensions(this._clientWidth, this._clientHeight,  this._clientWidth, this.maxScroll + this._clientHeight);
				this.scroller.scrollTo(0, this.scrollPosition * this._scale, false);
			}else{
				this.scroller.setDimensions(this._clientWidth, this._clientHeight,  this.maxScroll + this._clientWidth, this._clientHeight);
				this.scroller.scrollTo(this.scrollPosition * this._scale, 0, false);
			}
		},200)
		
	}
}

export default StoryScroll;