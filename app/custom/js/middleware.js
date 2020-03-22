window.middleware = (function () {

    var firebaseConfig = { // Configuracion firebase
        apiKey: "AIzaSyDcBhhiu-dQXWaGBLcTEtnz8HPnelfXuA4",
        authDomain: "covid19-autotest.firebaseapp.com",
        databaseURL: "https://covid19-autotest.firebaseio.com",
        projectId: "covid19-autotest",
        storageBucket: "covid19-autotest.appspot.com",
        messagingSenderId: "541298094681",
        appId: "1:541298094681:web:a715a3322843f6ff7e7748",
        measurementId: "G-0YZX1RVB1F"
    };

    var DEBUG = true; // Version debugging

    var public = {}; // Metodos y atributos publicos
    var private = {}; // Metodos y atributos privados

    public.init = function () { // Inicializacion del middleware. Descarga de configuracion
        return new Promise(function (fulfill, reject) {
            try {
                firebase.initializeApp(firebaseConfig);
                firebase.analytics();

                // Descarga de parametros de configuracion
                // Se intenta descargar la configuracion de firebase (se usa un cache local por una hora)
                // Si no se logra descargar la configuracion de firebase, se descarga una del server host

                var getStaticConfig = function () { // Leer configuracion del server host
                    if (DEBUG) console.log("Recurso de configuracion: hosting");
                    $.getJSON("custom/config.json",
                        fulfill, // Pasar directamente a la verificacion 
                        function (err) {
                            return reject(err);
                        }
                    );
                };

                var getRemoteConfig = function () { // Leer configuracion de firebase o en caso de error traer del hosting
                    public.db.get("config") // Descargar configuracion de firebase
                        .then(function (config) { // Callback
                            if (config) { // Hay datos
                                private.config = config; // Cachear la descarga
                                private.configTimestamp = Date.now();
                                if (DEBUG) console.log("Recurso de configuracion: DB");
                                fulfill(config) // Verificar
                            } else // Si no hay datos, usar version statica
                                getStaticConfig();
                        })
                        .catch(function (err) { // Ante error de consulta (puede ser por permisos)
                            if (DEBUG) console.log(err);
                            getStaticConfig(); // Tomar datos de la configuracion estatica
                        });
                };

                if (!private.config) { // Si no hay ninguna configuracion guardada en variable
                    getRemoteConfig(); // Intentar descargar de firebase
                } else { // Si hay una guardada, verificar antiguedad
                    if (Date.now() - private.configTimestamp < 3600000) { // Si paso menos de una hora de la ultima descarga, usar la que esta
                        if (DEBUG) console.log("Recurso de configuracion: cache");
                        fulfill(private.config);
                    } else { // Si tiene mas de una hora, intentar descargar una nueva
                        getRemoteConfig();
                    }
                }
            } catch (e) {
                return reject(e);
            }
        });
    };

    public.getTree = function () { // Leer arbol de decision desde hosting
        return new Promise(function (fulfill, reject) {

            var getStaticTree = function () { // Descargar version de hosting
                $.getJSON("custom/tree.json", function (result) {
                    if (DEBUG) console.log(result);
                    return fulfill(result);
                }, function (err) {
                    return reject(err);
                });
            };

            public.db.getSortedLimited("decisionTrees", "timestamp", 1)
                .then(function (snapshot) {
                    snapshot.forEach(function (data) {
                        if (DEBUG) console.log(data.val());
                        return fulfill(data.val());
                    })
                })
                .catch(function (err) { // Ante error de consulta (puede ser por permisos)
                    if (DEBUG) console.log(err);
                    getStaticTree(); // Tomar datos del archivo de hosting
                });
        });
    };

    public.checkLocation = function (config) { // Obtener posiscion del cliente y comparar con filtro de configuracion
        return new Promise(function (fulfill, reject) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (position) {
                    // Determinar distancia al centro del area
                    var deltaX = position.coords.latitude - config.locationFilter.lat;
                    var deltaY = position.coords.longitude - config.locationFilter.lng;
                    var range = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (DEBUG) {
                        console.log("Filtro: Lat.: " + position.coords.latitude + " -- Lng: " + position.coords.longitude);
                        console.log("Cliente: Lat: " + config.locationFilter.lat + " -- Lng: " + config.locationFilter.lng);
                        console.log("Distancia: " + range);
                    }

                    if (range < config.locationFilter.range) // Si esta dentro de rango, retornar posicion
                        return fulfill({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    else // Si no pertenece al area de analisis
                        return reject({
                            msg: "Usuario fuera de area"
                        });
                });
            } else {
                return reject({
                    msg: "No se pudo determinar ubicación."
                });
            }
        });
    };

    return public;
})();