//import gpio and lcd driver dependencies 
var gpio = require('pi-gpio');
var LCD = require('lcdi2c');
var lcd = new LCD(1, 0x27, 16, 2);

//initialize LCD driver
lcd.clear();
lcd.on();

var length, index, text;

module.exports = {
	//turn on LED at 'pin' for 'duration' ms
	flashLED: function(pin, duration){
		gpio.open(pin, "output", function(err){
			gpio.write(pin, 1, function(){
				setTimeout(function(){gpio.close(pin)}, duration);
			});
		});
	},

	//scroll text across 16x2 lcd
	scroll: function(pText, speed, repeat){
		length = pText.length;	
		text = pText + "                ";
		index = 0;
		setInterval(function(){
			lcd.println(text.substring(index, index+16), 1);
			index++;
			if(index > length)
				if(repeat)
					index = 0;
				else
					return;
		}, speed);	
	},
	
	println: function(text, line){
		lcd.println(text, line);
	},

	clear: function(){
		lcd.clear();
	},

	off: function(){
		lcd.clear();
		lcd.off();
	},
	
	on: function(){
		lcd.clear();
		lcd.on();
	},

	gpio_close: function(pin){
		gpio.close(pin);
	},
}
