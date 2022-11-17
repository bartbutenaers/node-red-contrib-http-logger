# node-red-contrib-http-logger
A Node Red node for logging HTTP (or HTTPS) requests and responses.

This node is based on the [interceptors](https://www.npmjs.com/package/@mswjs/interceptors) library, a low-level HTTP/HTTPS/XHR/fetch request interception library.  This node can intercept both http and https requests and their related responses. 

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-http-logger
```

## Usage
In Node-RED multiple nodes are available for sending requests over HTTP and HTTPS (HttpRequest node, ...).  Since Node-RED runs on top of NodeJS, all the corresponding data transfer will be handle by the http and https modules in NodeJS.  However these modules will be adding information to the http(s) requests behind the scenes, and that final request will not be visible to the Node-RED user.

This might be a problem during troubleshooting.  For example your IP camera works fine in the browser, but when you use the same URL/username/password in Node-RED it fails.  This means that your browser and Node-RED send a different request to your IP camera.  To be able to solve this problem, you will need to compare both requests. 

OFten people ask on the Node-RED [Discourse](nodered.discourse.org) forum: when I access an url via ***curl*** then everything works fine, but it fails when using the same URL via the http-request node.  In that case this node can be used to see the http request being send by NodeJs, and compare it to the http request being send by curl (which can be displayed using `curl -v` to get a verbose output log).

Using this node, it will be possible to **intercept** the HTTP(S) requests and responses from NodeJS (without having to use external tools like Wireshark ...).  The following diagram summarizes how this HTTP logger node can be used, for example in conjuction with the HttpRequest node:

![Diagram](/images/listener_diagram.png)

1. A http(s) request will be initiated by e.g. the HttpRequest node.
2. This HTTP logger node intercepts the HTTP(S) **request** in NodeJS.
3. The server responds with a HTTP(S) request, which will be directed to the HttpRequest node.
4. This HTTP logger node intercepts the HTTP(S) **response** in NodeJS.
5. This HTTP logger node combines the associated request/response pair in an output message.

## Control the logger
Since intercepting requests and responses will use extra system resources (cpu ...), this HTTP logger node should only be started when necessary.  Once you have collected all required information, the logger should be stopped.  When adding a new HTTP logger node to your flow, it will be stopped by default.  And when the flow is (re)deployed, the HTTP logger will be stopped automatically.

The following flow explains how the logger can be started (```msg.payload = true```) and stopped (```msg.payload = false```):

![Control](/images/listener_control.png)

```
[{"id":"62bced82.805f44","type":"debug","z":"ee071e5f.cf0cc","name":"http debug","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":2190,"y":320,"wires":[]},{"id":"739977a4.750e78","type":"inject","z":"ee071e5f.cf0cc","name":"Start","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":1750,"y":320,"wires":[["84ccbdbb.77198"]]},{"id":"d5ffd364.3920e","type":"inject","z":"ee071e5f.cf0cc","name":"Stop","topic":"","payload":"false","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":1750,"y":360,"wires":[["84ccbdbb.77198"]]},{"id":"84ccbdbb.77198","type":"http-logger","z":"ee071e5f.cf0cc","name":"Listen for api.ipify.org","filter":"api.ipify.org","x":1972,"y":320,"wires":[["62bced82.805f44"]]}]
```

## Filtering
A large number of HTTP(S) requests might be processed by NodeJS continiously, triggered by your Node-RED flow.  This means that this HTTP logger node would produce a large amount of output messages.  As a result the large number of intercepted requests will become rather useless and your Node-RED flow might even become unresponsive!  To limit the number of output messages, it is highly advised to specify a filter!

When e.g. the HttpRequest node sends a request to *https://api.ipify.org* and this fails, you only want to intercept those specific requests.  This can be accomplished for example by specifying the following filter in the HTTP logger node's config screen:

![Filter](/images/listener_filter.png)

If ***all*** requests need to be intercepted, the URL field need to be ***empty***!  If you want e.g. only intercept the secure requests, add *'https'* as filter text. 

## Return (body format)
Select the data type (JSON object, UTF8-string, Buffer) of both the request body and the response body.

Following flow logs the bodies in the 3 available formats, as soon as a http request is intercepted:

![Return type](/images/listener_return.png)

```
[{"id":"f57450ea.ac8b","type":"http-logger","z":"5a89baed.89e9c4","name":"","filter":"ipify","returnFormat":"txt","x":400,"y":1000,"wires":[["f164a8b7.74cde8"]]},{"id":"1f25cbf8.71f354","type":"http request","z":"5a89baed.89e9c4","name":"","method":"GET","ret":"obj","paytoqs":false,"url":"https://api.ipify.org?format=json","tls":"","proxy":"","authType":"basic","x":390,"y":940,"wires":[["9f433261.35598"]]},{"id":"cedfb31a.2f4ee","type":"inject","z":"5a89baed.89e9c4","name":"Send request","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":940,"wires":[["1f25cbf8.71f354"]]},{"id":"9f433261.35598","type":"debug","z":"5a89baed.89e9c4","name":"Http response 1","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":600,"y":940,"wires":[]},{"id":"85b98128.01148","type":"inject","z":"5a89baed.89e9c4","name":"Start logging","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":1000,"wires":[["f57450ea.ac8b","58b2d51c.200b4c","985b3d33.f275a"]]},{"id":"f164a8b7.74cde8","type":"debug","z":"5a89baed.89e9c4","name":"Intercepted request as string","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":640,"y":1000,"wires":[]},{"id":"58b2d51c.200b4c","type":"http-logger","z":"5a89baed.89e9c4","name":"","filter":"ipify","returnFormat":"obj","x":400,"y":1060,"wires":[["c35e45c7.b75fb8"]]},{"id":"c35e45c7.b75fb8","type":"debug","z":"5a89baed.89e9c4","name":"Intercepted request as json object","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":660,"y":1060,"wires":[]},{"id":"94cb8a6e.256c18","type":"comment","z":"5a89baed.89e9c4","name":"Get WAN address from https://api.ipify.org?format=json","info":"","x":320,"y":900,"wires":[]},{"id":"985b3d33.f275a","type":"http-logger","z":"5a89baed.89e9c4","name":"","filter":"ipify","returnFormat":"bin","x":400,"y":1120,"wires":[["e8d8499a.c63698"]]},{"id":"e8d8499a.c63698","type":"debug","z":"5a89baed.89e9c4","name":"Intercepted request as buffer","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":640,"y":1120,"wires":[]}]
```
Which results in following debug panel entries:

![Return type debug](/images/listener_return_debug.png)

## Example flows

### Multiple http-logger nodes

Multiple http-logger nodes can be used simultaneously.  A different (url) filter can be specified in each of those nodes.

Following example flow has one logger for hostname ```api.ipify.org``` and another logger for hostname ```ip.seeip.org```:
![Example](/images/listener_example.png)

```
[{"id":"f57450ea.ac8b","type":"http-logger","z":"5a89baed.89e9c4","name":"","filter":"ipify","x":400,"y":980,"wires":[["f164a8b7.74cde8"]]},{"id":"1f25cbf8.71f354","type":"http request","z":"5a89baed.89e9c4","name":"","method":"GET","ret":"txt","paytoqs":false,"url":"https://api.ipify.org?format=json","tls":"","proxy":"","authType":"basic","x":390,"y":940,"wires":[["9f433261.35598"]]},{"id":"cedfb31a.2f4ee","type":"inject","z":"5a89baed.89e9c4","name":"Send request","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":940,"wires":[["1f25cbf8.71f354"]]},{"id":"9f433261.35598","type":"debug","z":"5a89baed.89e9c4","name":"Http response 1","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":600,"y":940,"wires":[]},{"id":"85b98128.01148","type":"inject","z":"5a89baed.89e9c4","name":"Start logging","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":980,"wires":[["f57450ea.ac8b"]]},{"id":"8b0fc961.02b618","type":"inject","z":"5a89baed.89e9c4","name":"Stop logging","topic":"","payload":"false","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":1020,"wires":[["f57450ea.ac8b"]]},{"id":"f164a8b7.74cde8","type":"debug","z":"5a89baed.89e9c4","name":"Intercepted http request 1","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":630,"y":980,"wires":[]},{"id":"58b2d51c.200b4c","type":"http-logger","z":"5a89baed.89e9c4","name":"","filter":"seeip","x":400,"y":1160,"wires":[["c35e45c7.b75fb8"]]},{"id":"ab3a938d.c4ed","type":"http request","z":"5a89baed.89e9c4","name":"","method":"GET","ret":"txt","paytoqs":false,"url":"https://ip.seeip.org/jsonip?","tls":"","proxy":"","authType":"basic","x":390,"y":1120,"wires":[["36675339.ca6cec"]]},{"id":"1ddffe5.a9a3302","type":"inject","z":"5a89baed.89e9c4","name":"Send request","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":1120,"wires":[["ab3a938d.c4ed"]]},{"id":"36675339.ca6cec","type":"debug","z":"5a89baed.89e9c4","name":"Http response 2","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":600,"y":1120,"wires":[]},{"id":"701fb48f.d9e74c","type":"inject","z":"5a89baed.89e9c4","name":"Start logging","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":1160,"wires":[["58b2d51c.200b4c"]]},{"id":"50fcbe2d.b7f8b","type":"inject","z":"5a89baed.89e9c4","name":"Stop logging","topic":"","payload":"false","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":210,"y":1200,"wires":[["58b2d51c.200b4c"]]},{"id":"c35e45c7.b75fb8","type":"debug","z":"5a89baed.89e9c4","name":"Intercepted http request 2","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":630,"y":1160,"wires":[]},{"id":"94cb8a6e.256c18","type":"comment","z":"5a89baed.89e9c4","name":"Get WAN address from https://api.ipify.org?format=json","info":"","x":320,"y":900,"wires":[]},{"id":"c10c9b7e.b4a5e8","type":"comment","z":"5a89baed.89e9c4","name":"Get WAN address from https://ip.seeip.org/jsonip?","info":"","x":310,"y":1080,"wires":[]}]
```

### Intercepting images

This node can also intercept responses that contain binary data like e.g. images.  The data chunks will be recombined (in a performant way) to recreate the original response body.  The following example flow demonstrates how to intercept images arriving from a public webcam:

![interceptor](https://user-images.githubusercontent.com/14224149/202565694-36449f2d-767d-45a8-8f40-0e0c101b2a13.gif)
```
[{"id": "5debdd9233a2926a","type": "http request","z": "8b52e098cd5f73fd","name": "","method": "GET","ret": "bin","paytoqs": "ignore","url": "http://webcam1.comune.ra.it/record/current.jpg","tls": "","persist": false,"proxy": "","insecureHTTPParser": false,"authType": "","senderr": false,"headers": [],"x": 1650,"y": 1160,"wires": [["fdadb18dc03f3e40"]]},{"id": "607cba4a30069016","type": "inject","z": "8b52e098cd5f73fd","name": "Fetch image","props": [],"repeat": "","crontab": "","once": false,"onceDelay": 0.1,"topic": "","x": 1450,"y": 1160,"wires": [["5debdd9233a2926a"]]},{"id": "09ec9937af9f99ac","type": "inject","z": "8b52e098cd5f73fd","name": "Start intercepting","props": [{"p": "payload"},{"p": "topic","vt": "str"}],"repeat": "","crontab": "","once": false,"onceDelay": 0.1,"topic": "","payload": "true","payloadType": "bool","x": 1460,"y": 1480,"wires": [["75388891e516c785"]]},{"id": "75388891e516c785","type": "http-logger","z": "8b52e098cd5f73fd","name": "Intercept bekescsaba","filter": "webcam1.comune","returnFormat": "bin","x": 1680,"y": 1480,"wires": [["2ac8858cead8cec5"]]},{"id": "2ac8858cead8cec5","type": "image","z": "8b52e098cd5f73fd","name": "Show intercepted response","width": "320","data": "response.body","dataType": "msg","svg": "svg","svgType": "msg","thumbnail": false,"active": true,"pass": false,"outputs": 0,"x": 1940,"y": 1480,"wires": []},{"id": "fdadb18dc03f3e40","type": "image","z": "8b52e098cd5f73fd","name": "Show response","width": "320","data": "payload","dataType": "msg","svg": "svg","svgType": "msg","thumbnail": false,"active": true,"pass": false,"outputs": 0,"x": 1860,"y": 1160,"wires": []}]
```
