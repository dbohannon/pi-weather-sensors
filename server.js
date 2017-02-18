//import dependencies
var express = require('express');
var bodyParser = require('body-parser');
var lcd_control = require('./scripts/lcd_control.js'); 
var gpio = require('pi-gpio');
var dht = require('node-dht-sensor');
var raspiSensors = require('raspi-sensors');
var mongodb = require('mongodb').MongoClient;
var schedule = require('node-schedule');

//MongoDB Connection URI
var conn = 'mongodb://localhost:27017/weather';

//LCD Toggle
var LCD = true;

//global object used to store sensor data
var data = {};

//create Express server instance
var app = express();
app.listen(8000, function(){
	console.log('Express server listening on port %d.', this.address().port);
	//lcd_control.scroll('Express server listening on port ' +  this.address().port);
	lcd_control.println('Express server', 1);
	lcd_control.println('on port ' + this.address().port, 2);
	//poll sensors every 3 seconds
	setInterval(function(){
		//flash green LED 
		lcd_control.flashLED(7, 250); 
		//get date/time
		get_time();
		//get photon data
		get_photon_data(11);
		//get temp and humidity data (GPIO pin #)
		get_temp_data(18);
		//get barometric pressure data
		get_bmp_data();
		//print data to lcd if populated
		if(Object.keys(data).length >= 6 && LCD){
			//format time and print to line 1
			var line1 = data['time'].split(':');
			line1 = line1[0] + ':' + line1[1] + '    ';
			lcd_control.println(line1, 1);
			//format data and print to line 2
			var line2 = data['temp_F'] + 'F, ' + data['humidity'] + '%, ' + data['pressure_atm'] + ' ';
			/*
			if(Boolean(data['photon']))
				line2 = line2 + ', light';
			else 
				line2 = line2 + ', dark ';
			*/
			lcd_control.println(line2, 2);
		}
	}, 3000);
	//print data to console log every minute
	setInterval(function(){
		console.log(JSON.stringify(data));
	}, 60000);
	//log to MongoDB every 30 minutes
	schedule.scheduleJob('0,30 * * * *' ,function(){
		mongodb.connect(conn, function(err, db) {
			if(err)
				console.log('MongoDB connection error!');
			else{
				var tmp = JSON.parse(JSON.stringify(data));
				db.collection('sensors.data').save(tmp);
			}		
			db.close();
		});
	});
});

// enable POST body parsing
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// enable static public file serving
app.use(express.static(__dirname + "/public"));

//APP ROUTES START
//index page 
app.get('/', function(req, res){
	res.sendFile('./html/index.html', {root: __dirname});
});

//return all sensor data as JSON
app.get('/api/sensors/all', function(req, res){
	res.send(JSON.stringify(data));
});

//return all sensor data for past 24 hours (30 min intervals * 48 entries)
app.get('/api/sensors/db_query', function(req, res){
	mongodb.connect(conn, function(err, db) {
		if(err){
			console.log('MongoDB connection error!');
			res.status(500).send();
		}
		else{
			//sort all entries in descenting order based on _id (based on system time) and return first 48 (i.e., 24 hours worth) 
			db.collection('sensors.data').find({},{_id: 0}).sort({_id: -1}).limit(48).toArray(function(err, documents){
				if(err)
					res.status(500).send();
				else
					//send array of results to client
					res.send(documents);
			});
		}		
		db.close();
	});
});

//toggle LCD screen on/off
app.get('/api/lcd/toggle', function(req, res){
	if(LCD){
		lcd_control.off();
		LCD = false;
	}
	else{
		lcd_control.on();
		LCD = true;
	}
	res.status(200).send();
});

//shutdown Express server
app.get('/api/shutdown', function(req, res){
	res.status(200).send();
	shutdown();
});

//clean up after SIGINT received
process.on('SIGINT', function() {
	shutdown();
});

function shutdown(){
	console.log("Stopping server...");

	//turn off LCD
	lcd_control.clear();
	lcd_control.off();

	//turn off LEDs
	lcd_control.gpio_close(7);

	//turn off sensor pins
	lcd_control.gpio_close(11);
	lcd_control.gpio_close(12);	//aka GPIO 18

	process.exit(0);
}

//GPIO FUNCTIONS

function get_time(){
	var date = new Date();
	data['time'] = date.toLocaleString();
}

function get_photon_data(pin){
	gpio.open(pin, 'input pulldown', function(err){
		if(err)
		console.log(err);
		gpio.read(pin, function(err, value){
			data['photon'] = value;
			gpio.close(pin);
		});
	});
}

function get_temp_data(pin){
	dht.read(11, pin, function(err, temperature, humidity) {
		if (!err) {
			data['temp_F'] = (temperature * 1.8 + 32).toFixed(0);
			data['humidity'] = humidity.toFixed(0);
		}
		//else
		//	console.log("DHT11 %s", err);
	});	
}

var bmp180 = new raspiSensors.Sensor({
	type: 'BMP180',
	address: 0x77
});

function get_bmp_data(){
	bmp180.fetch(function(err, pData){
		if(!err){
			if(pData.type === 'Pressure'){
				data['pressure_atm'] = (pData.value * 0.00000986923267).toFixed(3);
				data['pressure_pa'] = pData.value;
			}
		}
		else
			console.log(err);
	});	
}
