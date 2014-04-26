var mocks = {
    getFakeView: function(width, height) {
        return {
            handler:             false,
            clientWidth:         width,
            clientHeight:        height,
            addEventListener:    function(handler) { this.handler = handler; },
            removeEventListener: function() {this.handler = false; },
            children: [
                {
                    children:    [],
                    id:          0,
                    style:       {},

                    appendChild: function(child) {
                        child.__mockId = ++this.id;
                        this.children.push(child);
                    },

                    removeChild: function(child) {
                        for(var i = 0; i < this.children.length; i++) {
                            if(this.children[i].__mockId === child.__mockId) {
                                this.children.splice(i,1);
                                return;
                            }
                        }
                    }
                }
            ]
        };
    }
};

module.exports = mocks;