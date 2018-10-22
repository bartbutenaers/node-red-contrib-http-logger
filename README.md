# node-red-contrib-http-logger
A Node Red node for logging HTTP (or HTTPS) requests and responses

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-http-logger
```

## Usage
In Node-RED multiple nodes are available for sending requests over HTTP and HTTPS (HttpRequest node, [Multipart stream node](https://github.com/bartbutenaers/node-red-contrib-multipart-stream-decoder), ...).  Since Node-RED runs on top of NodeJS, all the corresponding data transfer will be handle by the http and https modules in NodeJS.  However these modules will be adding information to the http(s) requests behind the scenes, and that final request will not be visible to the Node-RED user.

This might be a problem during troubleshooting.  For example your IP camera works fine in the browser, but when you use the same URL/username/password in Node-RED it fails.  This means that your browser and Node-RED send a different request to your IP camera.  To be able to solve this problem, you will need to compare both requests. 

Using this node, it will be possible to **intercept** the HTTP(S) requests and responses from NodeJS (without having to use external tools like Wireshark ...).  The following diagram summarizes how this HTTP logger node can be used, for example in conjuction with the HttpRequest node:

![Diagram](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-http-logger/master/images/listener_diagram.png)

1. A http(s) request will be initiated by e.g. the HttpRequest node.
2. This HTTP logger node intercepts the HTTP(S) **request** in NodeJS.
3. The server responds with a HTTP(S) request, which will be directed to the HttpRequest node.
4. This HTTP logger node intercepts the HTTP(S) **response** in NodeJS.
5. This HTTP logger node combines the associated request/response pair in an output message.

## Control the logger
Since intercepting requests and responses will use extra system resources (cpu ...), this HTTP logger node should only be started when necessary.  Once you have collected all required information, the logger should be stopped.  When adding a new HTTP logger node to your flow, it will be stopped by default.  And when the flow is (re)deployed, the HTTP logger will be stopped automatically.

The following flow explains how the logger can be started (```msg.payload = true```) and stopped (```msg.payload = false```):

![Control](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-http-logger/master/images/listener_control.png)

```
[{"id":"62bced82.805f44","type":"debug","z":"ee071e5f.cf0cc","name":"http debug","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":2190,"y":320,"wires":[]},{"id":"739977a4.750e78","type":"inject","z":"ee071e5f.cf0cc","name":"Start","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":1750,"y":320,"wires":[["84ccbdbb.77198"]]},{"id":"d5ffd364.3920e","type":"inject","z":"ee071e5f.cf0cc","name":"Stop","topic":"","payload":"false","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":1750,"y":360,"wires":[["84ccbdbb.77198"]]},{"id":"84ccbdbb.77198","type":"http-logger","z":"ee071e5f.cf0cc","name":"Listen for api.ipify.org","filter":"api.ipify.org","x":1972,"y":320,"wires":[["62bced82.805f44"]]}]
```

## Filtering
A large number of HTTP(S) requests might be processed by NodeJS continiously, triggered by your Node-RED flow.  This means that this HTTP logger node would produce a large amount of output messages.  As a result the large number of intercepted requests will become rather useless and your Node-RED flow might even become unresponsive!  To limit the number of output messages, it is highly advised to specify a filter!

When e.g. the HttpRequest node sends a request to *https://api.ipify.org* and this fails, you only want to intercept those specific requests.  This can be accomplished for example by specifying the following filter in the HTTP logger node's config screen:

![Filter](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-http-logger/master/images/listener_filter.png)

If ***all*** requests need to be intercepted, the URL field need to be ***empty***!  If you want e.g. only intercept the secure requests, add *'https'* as filter text. 
