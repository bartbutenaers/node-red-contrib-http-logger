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
    var Mitm = require("mitm"); 

    function HttpLoggerNode(config) {
        RED.nodes.createNode(this, config);
        this.filter = config.filter;

        var node = this;
        
        if (node.mitm) {
            node.status({fill:"blue", shape:"dot", text:"listening"});
        }

        function startListening() {
            // When no globalLog is enabled yet, let's initialize it now.
            // As soon as we do this, the globalLog (singleton) will start listening to http requests in NodeJs,
            if (!node.mitm) {
                node.mitm = Mitm();
             
                // Start listening to http(s) responses, and the corresponding requests
                node.mitm.on("request", function(req, res) {
                    if (!node.filter || node.filter.trim() === "" || request.href.indexOf(node.filter) >= 0) { 
                        node.send({request: request, response:response, topic:"success"});
                    }
                })
            }
            
            node.status({fill:"blue", shape:"dot", text:"listening"});
        }

        function stopListening() {
            if (node.mitm) {
                node.mitm.disable();
                node.mitm = null;
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
        });
    }

    RED.nodes.registerType("http-logger",HttpLoggerNode);
}
