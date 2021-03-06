define(['ol-custom', 'turf'], function(ol, turf) {
    for (var z = 0; z < 9; z++) {
        var key = 'ZOOM:' + z;
        var maxxy = 256 * Math.pow(2, z);

        (function(key, maxxy) {
            var projection = new ol.proj.Projection({
                code: key,
                // The extent is used to determine zoom level 0. Recommended values for a
                // projection's validity extent can be found at https://epsg.io/.
                extent: [0.0, 0.0, maxxy, maxxy],
                units: 'm'
            });
            ol.proj.addProjection(projection);

            // We also declare EPSG:21781/EPSG:4326 transform functions. These functions
            // are necessary for the ScaleLine control and when calling ol.proj.transform
            // for setting the view's initial center (see below).

            ol.proj.addCoordinateTransforms('EPSG:3857', projection,
                function(coordinate) {
                    var x = (coordinate[0] + ol.const.MERC_MAX) * maxxy / (2 * ol.const.MERC_MAX);
                    var y = (-coordinate[1] + ol.const.MERC_MAX) * maxxy / (2 * ol.const.MERC_MAX);
                    return [x, y];
                },
                function(coordinate) {
                    var x = coordinate[0] * (2 * ol.const.MERC_MAX) / maxxy - ol.const.MERC_MAX;
                    var y = -1 * (coordinate[1] * (2 * ol.const.MERC_MAX) / maxxy - ol.const.MERC_MAX);
                    return [x, y];
                });
        })(key, maxxy);
    }
    var baseDict = {
        osm: {
            mapID: 'osm',
            title: {
                ja: 'オープンストリートマップ',
                en: 'OpenStreetMap'
            },
            label: {
                ja: 'OSM(現在)',
                en: 'OSM(Now)'
            },
            attr: '©︎ OpenStreetMap contributors',
            maptype: 'base'
        },
        gsi: {
            mapID: 'gsi',
            title: {
                ja: '地理院地図',
                en: 'Geospatial Information Authority of Japan Map'
            },
            label: {
                ja: '地理院地図',
                en: 'GSI Map'
            },
            attr: {
                ja: '国土地理院',
                en: 'The Geospatial Information Authority of Japan'
            },
            maptype: 'base',
            url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
            maxZoom: 18
        },
        gsi_ortho: {
            mapID: 'gsi_ortho',
            title: {
                ja: '地理院地図オルソ航空写真',
                en: 'Geospatial Information Authority of Japan Ortho aerial photo'
            },
            label: {
                ja: '地理院オルソ',
                en: 'GSI Ortho'
            },
            attr: {
                ja: '国土地理院',
                en: 'The Geospatial Information Authority of Japan'
            },
            maptype: 'base',
            url: 'https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg',
            maxZoom: 18
    },
    };

    ol.source.HistMap = function(optOptions) {
        var options = optOptions || {};
        options.wrapX = false;
        if (!options.imageExtention) options.imageExtention = 'jpg';
        if (options.mapID) {
            this.mapID = options.mapID;
            options.url = options.url || 'tiles/' + options.mapID + '/{z}/{x}/{y}.' + options.imageExtention;
        }

        if (options.urls) {
            this._tileUrlFunction =
                ol.TileUrlFunction.createFromTemplates(
                    options.urls);
        } else if (options.url) {
            this._tileUrlFunction =
                ol.TileUrlFunction.createFromTemplates(
                    ol.TileUrlFunction.expandUrl(options.url));
        }

        this.width = options.width;
        this.height = options.height;
        var zW = Math.log2(this.width/ol.tileSize);
        var zH = Math.log2(this.height/ol.tileSize);
        this.maxZoom = options.maxZoom = Math.ceil(Math.max(zW, zH));
        this._maxxy = Math.pow(2, this.maxZoom) * ol.tileSize;
        options.tileUrlFunction = options.tileUrlFunction || function(coord) {
            var z = coord[0];
            var x = coord[1];
            var y = -1 * coord[2] - 1;
            if (x * ol.tileSize * Math.pow(2, this.maxZoom - z) >= this.width ||
                y * ol.tileSize * Math.pow(2, this.maxZoom - z) >= this.height ||
                x < 0 || y < 0 ) {
                return ol.transPng;
            }
            return this._tileUrlFunction(coord);
        };

        ol.source.XYZ.call(this, options);
        ol.source.setCustomInitialize(this, options);

        ol.source.setupTileLoadFunction(this);
    };

    ol.inherits(ol.source.HistMap, ol.source.XYZ);

    ol.source.HistMap.getTransPng = function() {
        return ol.transPng;
    };

    ol.source.HistMap.createAsync = function(options, commonOptions) {
        if (typeof options === 'string') {
            options = baseDict[options];
        }

        options = Object.assign(options, commonOptions);
        options.label = options.label || options.year;
        options.sourceID = options.sourceID || options.mapID;
        if (options.maptype == 'base' || options.maptype == 'overlay') {
            var targetSrc = options.maptype == 'base' ? ol.source.NowMap : ol.source.TmsMap;
            if (options.zoom_restriction) {
                options.maxZoom = options.maxZoom || options.merc_max_zoom;
                options.minZoom = options.minZoom || options.merc_min_zoom;
            }
            options.zoom_restriction = options.merc_max_zoom = options.merc_min_zoom = undefined;
            if (options.translator) {
                options.url = options.translator(options.url);
            }
            return targetSrc.createAsync(options).then(function(obj) {
                return obj.initialWait.then(function() {
                    return obj;
                });
            });
        } else if (options.noload) {
            return new Promise(function(res, rej) {
                requirejs(['histmap_tin'], res);
            }).then(function() {
                options.merc_max_zoom = options.merc_min_zoom = undefined;
                return new ol.source.HistMap_tin(options);
            });
        }

        return new Promise(function(resolve, reject) {
            var url = options.setting_file || 'maps/' + options.mapID + '.json';
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'json';

            xhr.onload = function(e) {
                if (this.status == 200 || this.status == 0 ) { // 0 for UIWebView
                    try {
                        var resp = this.response;
                        if (typeof resp != 'object') resp = JSON.parse(resp);
                        options = Object.assign(resp, options);
                        options.label = options.label || resp.year;
                        if (options.translator) {
                            options.url = options.translator(options.url);
                        }
                        if (!options.maptype) options.maptype = 'maplat';

                        if (options.maptype == 'base' || options.maptype == 'overlay') {
                            var targetSrc = options.maptype == 'base' ? ol.source.NowMap : ol.source.TmsMap;
                            targetSrc.createAsync(options).then(function(ret) {
                                resolve(ret);
                            });
                            return;
                        }

                        new Promise(function(res, rej) {
                            requirejs(['histmap_tin'], res);
                        }).then(function() {
                            ol.source.HistMap_tin.createAsync(options)
                                .then(function(obj) {
                                    obj.initialWait.then(function() {
                                        obj.mapSize2MercSize(resolve);
                                    }).catch(function() {
                                        obj.mapSize2MercSize(resolve);
                                    });
                                }).catch(function(err) {
                                    reject(err);
                                });
                        }).catch(function(err) {
                            reject(err);
                        });
                    } catch(err) {
                        reject(err);
                    }
                } else {
                    reject('Fail to load map json');
                    // self.postMessage({'event':'cannotLoad'});
                }
            };
            xhr.send();
        });
    };

    ol.source.setCustomFunction(ol.source.HistMap);

    ol.source.HistMap.prototype.xy2MercAsync = function(xy) {
        var convertXy = this.histMapCoords2Xy(xy);
        return this.xy2MercAsync_(convertXy);
    };
    ol.source.HistMap.prototype.merc2XyAsync = function(merc) {
        var self = this;
        return this.merc2XyAsync_(merc).then(function(convertXy) {
            return self.xy2HistMapCoords(convertXy);
        }).catch(function(err) { throw err; });
    };

    ol.source.HistMap.prototype.mapSize2MercSize = function(callback) {
        var xy = [this.width / 2, this.height / 2];
        var self = this;
        Promise.all([[xy[0] - 150, xy[1]], [xy[0] + 150, xy[1]], [xy[0], xy[1] - 150], [xy[0],
            xy[1] + 150], [xy[0], xy[1]], [0, 0], [this.width, 0], [this.width, this.height], [0, this.height]].map(function(coord) {
            return self.xy2MercAsync_(coord);
        })).then(function(mercs) {
            var delta1 = Math.sqrt(Math.pow(mercs[0][0] - mercs[1][0], 2) + Math.pow(mercs[0][1] - mercs[1][1], 2));
            var delta2 = Math.sqrt(Math.pow(mercs[2][0] - mercs[3][0], 2) + Math.pow(mercs[2][1] - mercs[3][1], 2));
            var delta = (delta1 + delta2) / 2;
            self.merc_zoom = Math.log(300 * (2*ol.const.MERC_MAX) / 256 / delta) / Math.log(2) - 3;
            self.home_position = ol.proj.toLonLat(mercs[4]);
            self.envelop = turf.helpers.polygon([[mercs[5], mercs[6], mercs[7], mercs[8], mercs[5]]]);
            callback(self);
        }).catch(function(err) {
            throw err;
        });
    };

    ol.source.HistMap.prototype.histMapCoords2Xy = function(histCoords) {
        var x = (histCoords[0] + ol.const.MERC_MAX) * this._maxxy / (2*ol.const.MERC_MAX);
        var y = (-histCoords[1] + ol.const.MERC_MAX) * this._maxxy / (2*ol.const.MERC_MAX);
        return [x, y];
    };

    ol.source.HistMap.prototype.xy2HistMapCoords = function(xy) {
        var histX = xy[0] * (2*ol.const.MERC_MAX) / this._maxxy - ol.const.MERC_MAX;
        var histY = -1 * (xy[1] * (2*ol.const.MERC_MAX) / this._maxxy - ol.const.MERC_MAX);
        return [histX, histY];
    };

    ol.source.HistMap.prototype.insideCheckXy = function(xy) {
        return !(xy[0] < 0 || xy[0] > this.width || xy[1] < 0 || xy[1] > this.height);
    };

    ol.source.HistMap.prototype.insideCheckHistMapCoords = function(histCoords) {
        return this.insideCheckXy(this.histMapCoords2Xy(histCoords));
    };

    ol.source.HistMap.prototype.modulateXyInside = function(xy) {
        var dx = xy[0] / (this.width / 2) - 1;
        var dy = xy[1] / (this.height / 2) - 1;
        var da = Math.max(Math.abs(dx), Math.abs(dy));
        return [(dx / da + 1) * this.width / 2, (dy / da + 1) * this.height / 2];
    };

    ol.source.HistMap.prototype.modulateHistMapCoordsInside = function(histCoords) {
        var xy = this.histMapCoords2Xy(histCoords);
        var ret = this.modulateXyInside(xy);
        return this.xy2HistMapCoords(ret);
    };

    return ol;
});
