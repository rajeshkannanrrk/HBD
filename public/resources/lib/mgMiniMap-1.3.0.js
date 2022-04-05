/**
 * mgMiniMap
 *
 * @version 1.1.0
 * @copyright magnoliyan
 */

;
(function( $, window, document, undefined ){

    /**
     * Default optons values
     */
    var defaults = {
        navigatorClass: "mgNavigator",
        viewportClass: "mgViewport",
        elements: false,
        liveScroll: false,
        scrollbarWidth: 20,
        defaultBgColor: '#AAA',
        draggable: false,
        resizable: false,
        debug: false,
        realistic: false,
        html2canvas: {},
        forceDom: false
    }

    /**
     * mgMiniMap constructor
     *
     * @param {object} elem
     * @param {object} options
     * @return {mgMiniMap}
     */
    var mgMiniMap = function( elem, options ){
        this.elem = elem;
        this.$elem = $(elem);
        if(this.elem == window){
            this.$relElem  = $('body');
        }
        else{
            this.$relElem  = this.$elem;
        }
        this.options = options;
        this.metadata = this.$elem.data("mgMiniMap-options" );
        this.config = $.extend({}, defaults, this.options, this.metadata);
        
        this.init();
        //store instance for later calls to plugin, like update
        this.$elem.data("mgMiniMap-instance",this);
        //flag to stop race
        this.updating = false;
    };

    /**
     * Init plugin - update dom, set properties
     */
    mgMiniMap.prototype.init = function(){
        var self = this;
        this.$navigator = $('<div class="' + this.config.navigatorClass + '"><canvas></canvas><div class="' + this.config.viewportClass + '"></div></div>').appendTo('body');
        this.navigatorPosition = this.$navigator.css('position');
        this.$canvas = this.$navigator.find('canvas');
        var canvasEl = this.$canvas.get(0);
        this.canvasSupported = !this.config.forceDom && canvasEl.getContext && canvasEl.getContext('2d');
        if(this.canvasSupported){
            this.ctx= this.$canvas.get(0).getContext("2d");
        }
        else{
            this.$canvas.remove();
            this.$canvasDom = $('<div class="mgCanvasDom">').appendTo(this.$navigator);
        }
        this.$viewport = this.$navigator.find('.' + this.config.viewportClass);
        
        this.attachEvents();
        
        this.update();
    }

    /**
     * Force MiniMap to invalidate/repaint
     */
    mgMiniMap.prototype.update = function(viewportOnly){
        if(this.updating){
            this.debug('REJECTED, already updating');
            return false;
        }
        this.updating = true;
        if(viewportOnly){
            this.updateViewport();
            this.updating = false;
        }
        else{
            this.updateSizes();
            this.updateViewport();
            //if result is false we're still updating, html2canvas callback will close this
            if(false !== this.drawElements()){
                this.updating = false;
            }
        }        
    }

    /**
     * Update ratios, set sizes
     * 
     */
    mgMiniMap.prototype.updateSizes = function(){
        var self = this;

        self.debug('updating navigator sizes');

        //if applied to the window object
        if(this.elem == window){
            var scrollWidth = $(document).width(),
            scrollHeight = $(document).height();
            this.boardLeft = 0;this.boardTop = 0;
            this.scrollTop = 0;
            this.scrollLeft = 0;
        }
        else{
            var scrollWidth = this.elem.scrollWidth + this.config.scrollbarWidth,
            scrollHeight = this.elem.scrollHeight + this.config.scrollbarWidth;
            this.boardLeft = this.$elem.offset().left;
            this.boardTop = this.$elem.offset().top;
            this.scrollTop = this.$elem.scrollTop();
            this.scrollLeft = this.$elem.scrollLeft();
        }

        this.ratio = this.$navigator.width() / scrollWidth;
        var navigatorWidth = scrollWidth * this.ratio,
            navigatorHeight = scrollHeight * this.ratio;
        //max height
        if(this.config.maxHeight && navigatorHeight > this.config.maxHeight){
            navigatorHeight = this.config.maxHeight;
            this.ratio = navigatorHeight / scrollHeight;
            navigatorWidth = scrollWidth * this.ratio;
        }

        //apply dims to navigator
        this.$navigator.width(navigatorWidth).height(navigatorHeight);
        this.$canvas.attr("width", navigatorWidth).attr("height",navigatorHeight);

        this.debug({
            scrollTop: this.scrollTop,
            scrollLeft: this.scrollLeft,
            width: scrollWidth,
            height: scrollHeight,
            boardTop: this.boardTop,
            boardLeft: this.boardLeft
        });
    }
    
    /**
     * Update viewport - MiniMap frame
     */
    mgMiniMap.prototype.updateViewport = function(){
        this.debug('update viewport');
        //get height
        var height = this.$elem.height(),
            width = this.$elem.width(),
            top = this.$elem.scrollTop(),
            left = this.$elem.scrollLeft();

        this.debug({
            "width": width,
            "height": height,
            "top": top,
            "left": left
        });
        this.$viewport.css({'left':left * this.ratio,'top':top * this.ratio}).width(width * this.ratio).height(height * this.ratio);
    }    

    /**
     * Board is scrolled
     * @param {object} viewportPos
     */
    mgMiniMap.prototype.scrolled = function(viewportPos){
        var self = this;
        self.debug('viewport scrolled');        
        self.debug(viewportPos);
        self.$elem.scrollTop(viewportPos.top / self.ratio).scrollLeft(viewportPos.left / self.ratio);
    }

    /**
     * Attach to even hooks
     */
    mgMiniMap.prototype.attachEvents = function(){
        var self = this;

        this.scrolling = false;
        this.resizing = false;

        //make navigator draggable
        if(this.config.draggable){
            this.$navigator.append('<div class="mgHandle"></div>').draggable({
                handle: "div.mgHandle",
                stop: function (event, ui){
                    //keep original position, don't let jquery make it abs
                    self.$navigator.css('position',self.navigatorPosition);
                }
            });
        }
        //make navigator resizable
        if(this.config.resizable){
            this.$navigator.resizable({
                aspectRatio: true,
                helper: "mgResizing",
                start: function( event, ui ) {
                    self.resizing = true;
                },
                stop: function( event, ui ) {
                    self.debug('navigator resized');
                    self.update();
                    self.resizing = false;
                    //keep original position, don't let jquery make it abs
                    self.$navigator.css('position',self.navigatorPosition);
                }
            });
        }
        //click to navigate
        this.$navigator.on('click', function(e){
            var posX = e.pageX - $(this).offset().left - self.$viewport.width() / 2,
                posY = e.pageY - $(this).offset().top - self.$viewport.height() / 2,
                maxLeft = self.$navigator.width() - self.$viewport.width(),
                maxTop = self.$navigator.height() - self.$viewport.height();
            //check if off-canvas
            if(posX < 0){
                posX = 0;
            }
            if(posX > maxLeft){
                posX = maxLeft;
            }
            if(posY < 0){
                posY = 0;
            }
            if(posY > maxTop){
                posY = maxTop;
            }            
            self.$viewport.css({'left': posX, 'top': posY}); 
            self.scrolled(self.$viewport.position());
        });

        //drag view port
        this.$viewport.draggable({
            containment: "parent",
            start: function( event, ui ) {
                self.scrolling = true;
            },
            drag: function(event, ui ) {
                if(self.config.liveScroll){                    
                    self.scrolled(ui.position);
                }
            },
            stop: function( event, ui ) {
                //at the drag stop force scrolled event
                self.scrolling = false;
                self.scrolled(ui.position);
            }
        });

        //element scroll
        this.$elem.on('scroll', function() {
            if(!self.scrolling){
                self.debug('element scrolling');
                self.update(true);
            }
            else{
                self.debug('REJECTED scrolling');
            }
        });

        //resize
        this.$elem.on('resize', function() {
            //catch end of resize, clear previous timeouted events
            if(this.resizeTO){
                clearTimeout(this.resizeTO);
            }
            this.resizeTO = setTimeout(function() {
                self.debug('element resized...');
                self.update();
            }, 200);
        });
    }

    /**
     * Draw elements on canvas
     */
    mgMiniMap.prototype.drawElements = function(){
        this.debug('drawing elements');

        if(this.config.elements){
            this.elements = this.$relElem.find(this.config.elements);
        }
        else{
            this.elements = this.$relElem.children();
        }
        if(this.canvasSupported){
            if(this.config.realistic){
                this._drawElementsHtml2Canvas(this.$relElem);
                return false;
            }
            else{
                this._drawElementsCanvas();
            }
        }
        else{
            this._drawElementsDom();
        }
    }

    /**
     * Draw canvas using html2canvas
     */
    mgMiniMap.prototype._drawElementsHtml2Canvas = function(elementToDraw){
        this.debug('Html2Canvas drawing');
        var self = this;
        //clear canvas
        this.ctx.clearRect(0, 0, this.ctx.width, this.ctx.height);
        this.$navigator.hide();
        this.config.html2canvas.onrendered = function(canvas){
            var ourCanvas = self.$canvas.get(0);
            self.ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, ourCanvas.width, ourCanvas.height);
            self.$navigator.show();
            self.updating = false;
            self.debug('Html2Canvas end drawing');
        }
        this.config.html2canvas.width = elementToDraw.get(0).scrollWidth;
        this.config.html2canvas.height = elementToDraw.get(0).scrollHeight;        
        window.html2canvas(elementToDraw, this.config.html2canvas);
    }

    /**
     * Get elements position, color ...
     * 
     * @param {object} el
     * @return {object}
     */
    mgMiniMap.prototype.getElementProps = function(el){
        var pos = $(el).offset();
        var bgColor = ($(el).data('mg-color'))? $(el).data('mg-color') : $(el).css('background-color');
        if(bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent'){
            bgColor = false;
        }
        if(!bgColor){
            bgColor = this.config.defaultBgColor;    
        }        
        return {
            color: bgColor,
            left : (pos.left + this.scrollLeft - this.boardLeft) * this.ratio,
            top : (pos.top + this.scrollTop - this.boardTop) * this.ratio,
            width : $(el).width() * this.ratio,
            height : $(el).height() * this.ratio,
            shape: $(el).data('mgShape')
        };
    }

    /**
     * Draw elements on canvas when supported
     */
    mgMiniMap.prototype._drawElementsCanvas = function(){
        this.debug('canvas drawing');
        var self = this;
        //clear canvas
        this.ctx.clearRect(0, 0, this.ctx.width, this.ctx.height);
        $(this.elements).each(function(){
            var props = self.getElementProps(this);
            self.ctx.fillStyle = props.color;
            if (props.shape == 'triangle') {
                self.ctx.beginPath();
                self.ctx.moveTo(props.left, props.top);
                self.ctx.lineTo(props.left + props.width / 2, props.top + props.height);
                self.ctx.lineTo(props.left - props.width / 2, props.top + props.height);
                self.ctx.closePath();
                self.ctx.fill();
            }
            else if (props.shape == 'ellipse') {
                self.ctx.beginPath();
                self.ctx.ellipse(props.left + props.width / 2, props.top + props.height / 2, props.width / 2, props.height / 2, 0, 0, 2 * Math.PI);
                self.ctx.fill();
            }
            else if (props.shape == 'circle') {
                self.ctx.beginPath();
                self.ctx.arc(props.left + props.width / 2, props.top + props.height /2 , props.height / 2, 0, 2 * Math.PI, false);
                self.ctx.fill();   
            }
            else if (props.shape == 'diamond') {
                self.ctx.beginPath();
                self.ctx.moveTo(props.left, props.top + props.height / 2);
                self.ctx.lineTo(props.left + props.width / 2, props.top);
                self.ctx.lineTo(props.left + props.width, props.top + props.height / 2);
                self.ctx.lineTo(props.left + props.width / 2, props.top + props.height);
                self.ctx.lineTo(props.left,  props.top + props.height / 2);
                self.ctx.closePath();
                self.ctx.fill();
            }
            else if (props.shape == 'square') {
                self.ctx.lineWidth = 0.4;
                self.ctx.fillRect(props.left,props.top, props.width,props.height);
                self.ctx.strokeRect(props.left,props.top, props.width,props.height)
            }
            else {
                self.ctx.fillRect(props.left, props.top, props.width, props.height);
            }
        });
    }

    /**
     * Draw elements in dom, canvas not supported
     */
    mgMiniMap.prototype._drawElementsDom = function(){
        this.debug('dom drawing');
        var self = this;
        //clear canvas
        var elements = '';
        $(this.elements).each(function(){
            var props = self.getElementProps(this);            
            elements    += '<div style="background-color: ' + props.color + ';'
                        +  'left: ' + props.left + 'px;'
                        +  'top: ' + props.top + 'px;'
                        +  'width: ' + props.width + 'px;'
                        +  'height: ' + props.height + 'px;'
                        +  '"></div>'
        });
        this.$canvasDom.html(elements);
    }

    /**
     * Log to console if debugging is on
     * @param {object} content
     */
    mgMiniMap.prototype.debug = function(content){
        if(this.config.debug){
            console.log(content);
        }
    }

    /**
     * Jquery function
     * @param {object} options
     * @return {jQuery}
     */
    $.fn.mgMiniMap = function(options) {
        return this.each(function() {
            //just call existing instance
            if(options === 'update'){
                var navigator = $(this).data("mgMiniMap-instance");
                if(navigator){
                    navigator.update();
                }
            }
            else{
                new mgMiniMap(this, options);
            }
        });
    };
    
})( jQuery, window , document );