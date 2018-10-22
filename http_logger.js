/**
 * Copyright 2018 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 module.exports = function(RED) {
    var settings = RED.settings;
    var globalLog = require('global-request-logger'); 

    function HttpLoggerNode(config) {
        RED.nodes.createNode(this, config);
        this.filter = config.filter;

        var node = this;
        
        if (node.successHandler && node.errorHandler) {
            node.status({fill:"blue", shape:"dot", text:"listening"});
        }

        function handleSuccess(request, response) {
            if (!node.filter || node.filter.trim() === "" || request.href.indexOf(node.filter) >= 0) { 
                node.send({request: request, response:response, topic:"success"});
            }
        }

        function handleError(request, response) {
            if (!node.filter || node.filter.trim() === "" || request.href.indexOf(node.filter) >= 0) { 
                node.send({request: request, response:response, topic:"error"});
            }
        }

        function startListening() {
            // When no globalLog is enabled yet, let's initialize it now.
            // As soon as we do this, the globalLog (singleton) will start listening to http requests in NodeJs,
            if (!globalLog.isEnabled) {
                globalLog.initialize();
            }

            // Register a success handler, only if not registered yet
            if (!node.successHandler) {
                node.successHandler = handleSuccess;
                globalLog.on('success', node.successHandler);
            }

            // Register an error handler, only if not registered yet
            if (!node.errorHandler) {
                node.errorHandler = handleError;
                globalLog.on('error', node.errorHandler);
            }
            
            node.status({fill:"blue", shape:"dot", text:"listening"});
        }

        function stopListening() {
            // Unregister the success handler, if registered already
            if (node.successHandler) {
                globalLog.removeListener('success', node.successHandler);
                node.successHandler = null;
            }

            // Unregister the error handler, if registered already
            if (node.errorHandler) {
                globalLog.removeListener('error', node.errorHandler);
                node.errorHandler = null;
            }

            // When the globalLog is still enabled but no nodes are listening anymore, we can end the globalLog.
            // As soon as we do this, the globalLog (singleton) will stop listening to http requests in NodeJs.
            if (globalLog.isEnabled) {
                if (globalLog.listenerCount('success') === 0 && globalLog.listenerCount('error') === 0) {
                    globalLog.end();
                }
            }

            node.status({});            
        }

        node.on("input", function(msg) {
            // Start listening to http requests ...
            if(msg.payload == true) {
                startListening();
            }

            // Stop listening to http requests ...
            if(msg.payload == false) {                
                stopListening();
            } 
        });

        node.on("close", function() {
            // Stop listening to http requests when the node is closed.
            // Otherwise we would end up with multiple listeners for this node (e.g. after a deploy), which would
            // result in duplicate output messages...
            stopListening();
            
            this.status({});   
        });
    }

    RED.nodes.registerType("http-logger",HttpLoggerNode);
}
