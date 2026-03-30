/**
 * Homepage map: L.A. certified retail markets (Socrata XML), optional neighborhood context layer,
 * PlaceAutocompleteElement (Places API New) + Geocoder, driving-distance table (RouteMatrix). window.initAutocomplete = Maps callback.
 *
 * Pins use AdvancedMarkerElement + PinElement (requires mapId). Default DEMO_MAP_ID matches other pages in this repo;
 * for production, create a Map ID in Google Cloud → Map Management and replace MAP_ID below.
 * Flow: map loads → loadMarkets() XHRs XML → up to MAX_MARKET_PINS markers appear without searching.
 * Search only adds an origin pin + distance table.
 */
(function (global) {
  'use strict';

  var LA_CENTER = { lat: 34.0522, lng: -118.43 };
  var DEFAULT_ZOOM = 12;
  var MARKETS_XML =
    'https://data.lacity.org/api/views/g986-7yf9/rows.xml?accessType=DOWNLOAD';
  var MAX_MARKET_PINS = 400;
  var DIST_MATRIX_DEST_CAP = 25;
  /** Vector map + advanced markers; replace for production (Map Management in Google Cloud). */
  var MAP_ID = 'DEMO_MAP_ID';

  function downloadUrl(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        xhr.onreadystatechange = function () {};
        callback(xhr, xhr.status);
      }
    };
    xhr.open('GET', url, true);
    xhr.send(null);
  }

  function coliFillColor(coli) {
    var colors = ['#d1ccad', '#89a844', '#ad9202', '#a85d02', '#8a0e26'];
    if (coli >= 15) return colors[4];
    if (coli > 10) return colors[3];
    if (coli > 5) return colors[2];
    if (coli > 0) return colors[1];
    return colors[0];
  }

  function marketRowName(row) {
    var dba = row.getElementsByTagName('dba_name')[0];
    if (dba && dba.childNodes[0]) return dba.childNodes[0].data;
    var bn = row.getElementsByTagName('business_name')[0];
    if (bn && bn.childNodes[0]) return bn.childNodes[0].data;
    return 'Market';
  }

  function marketRowStreet(row) {
    var s = row.getElementsByTagName('street_address')[0];
    return s && s.childNodes[0] ? s.childNodes[0].data : '';
  }

  function formatDrivingDistanceMeters(meters) {
    if (meters == null || !isFinite(meters)) return '—';
    if (meters < 1000) return Math.round(meters) + ' m';
    var km = meters / 1000;
    var rounded = Math.round(km * 10) / 10;
    return (rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)) + ' km';
  }

  function routeMatrixFailureHtml(err) {
    var msg = err && err.message ? String(err.message) : String(err || 'Unknown error');
    var lower = msg.toLowerCase();
    if (
      lower.indexOf('permission') !== -1 ||
      lower.indexOf('denied') !== -1 ||
      lower.indexOf('403') !== -1 ||
      lower.indexOf('api key') !== -1
    ) {
      return (
        '<div class="header">Driving-distance request denied</div>' +
        '<p>The table uses <strong>Route Matrix</strong> (<code>RouteMatrix.computeRouteMatrix</code>). Enable the <strong>Routes API</strong> on the <em>same</em> Google Cloud project and API key as Maps.</p>' +
        '<ul style="margin:0.35em 0 0 1.1em;text-align:left;max-width:42em;margin-left:auto;margin-right:auto">' +
        '<li>Console → <strong>APIs &amp; Services</strong> → <strong>Library</strong> → enable <strong>Routes API</strong></li>' +
        '<li>Billing must be enabled</li>' +
        '<li>If the key uses <strong>HTTP referrer</strong> restrictions, allow your origins (e.g. <code>https://your-site.vercel.app/*</code>, <code>http://localhost:*/*</code>)</li>' +
        '</ul>' +
        '<p style="margin-top:0.75em;font-size:12px">' +
        'Migration: <a href="https://developers.google.com/maps/documentation/javascript/routes/route-matrix-js-migration" target="_blank" rel="noopener noreferrer">Distance Matrix → Route Matrix</a>' +
        '</p>'
      );
    }
    if (lower.indexOf('quota') !== -1 || lower.indexOf('resource_exhausted') !== -1) {
      return (
        '<div class="header">Distance quota exceeded</div>' +
        '<p>Check billing and quotas in Google Cloud Console.</p>'
      );
    }
    return (
      '<div class="header">Driving-distance request failed</div>' +
      '<p style="word-break:break-word">' +
      msg.replace(/</g, '&lt;') +
      '</p>'
    );
  }

  /** Adapts RouteMatrix row items to the shape expected by appendSortedDistanceRows. */
  function routeMatrixItemsAsLegacyElements(items) {
    if (!items || !items.length) return [];
    return items.map(function (item) {
      if (!item || item.error != null) return {};
      if (item.condition && item.condition !== 'ROUTE_EXISTS') return {};
      if (item.distanceMeters == null) return {};
      var m = item.distanceMeters;
      var loc = item.localizedValues && item.localizedValues.distance;
      var text = loc && loc.text ? loc.text : formatDrivingDistanceMeters(m);
      return { distance: { value: m, text: text } };
    });
  }

  function appendSortedDistanceRows(outputDiv, destNames, destinationList, results) {
    var disSorted = [];
    var j;
    for (j = 0; j < results.length; j++) {
      if (results[j].distance !== undefined) {
        disSorted.push({ value: results[j].distance.value, index: j });
      }
    }
    disSorted.sort(function (a, b) {
      return a.value - b.value;
    });

    var html = '';
    for (j = 0; j < disSorted.length; j++) {
      var rankCell;
      if (j === 0) {
        rankCell =
          '<h2 style="color:gold" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else if (j === 1) {
        rankCell =
          '<h2 style="color:silver" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else if (j === 2) {
        rankCell =
          '<h2 style="color:brown" class="ui center aligned header">#' + (j + 1) + '</h2>';
      } else {
        rankCell = '<h3 class="ui center aligned">#' + (j + 1) + '</h3>';
      }
      var idx = disSorted[j].index;
      html +=
        '<tr><td>' +
        rankCell +
        '</td><td>' +
        destNames[idx] +
        '</td><td>' +
        results[idx].distance.text +
        '</td><td>' +
        destinationList[idx] +
        '</td></tr>';
    }
    outputDiv.innerHTML += html;
  }

  function initAutocomplete() {
    var markerLibPromise =
      typeof google.maps.importLibrary === 'function'
        ? google.maps.importLibrary('marker')
        : Promise.reject(new Error('importLibrary not available'));

    var map = new google.maps.Map(document.getElementById('map'), {
      center: LA_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: 'roadmap',
      mapId: MAP_ID,
    });

    var marketInfoWindow = new google.maps.InfoWindow();
    var hoodInfoWindow = new google.maps.InfoWindow({ content: '' });

    var rows = null;
    var marketsReady = false;
    var searchMarkers = [];

    function setMarketLoadStatus(msg) {
      var el = document.getElementById('market-load-status');
      if (el) el.textContent = msg;
    }

    function loadMarkets() {
      if (typeof fetch !== 'function') {
        downloadUrl(MARKETS_XML, function (req) {
          if (req.status !== 200 && req.status !== 0) {
            marketsReady = true;
            setMarketLoadStatus('Market list request failed (HTTP ' + req.status + ').');
            return;
          }
          var xml = lacityParseSocrataXmlFromXhr(req);
          applyMarketsFromXmlDoc(xml);
        });
        return;
      }

      fetch(MARKETS_XML, { mode: 'cors', credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'application/xml');
          if (doc.getElementsByTagName('parsererror').length) {
            throw new Error('Invalid XML');
          }
          applyMarketsFromXmlDoc(doc);
        })
        .catch(function (err) {
          marketsReady = true;
          rows = rows || [];
          var hint = '';
          if (typeof location !== 'undefined' && location.protocol === 'file:') {
            hint =
              ' Cannot load from file:// — use a local server (e.g. npm run dev) or open the built site over http/https.';
          }
          setMarketLoadStatus('Could not load market data from data.lacity.org.' + hint + ' (' + (err && err.message) + ')');
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('loadMarkets:', err);
          }
        });
    }

    function applyMarketsFromXmlDoc(xml) {
      if (!xml) {
        marketsReady = true;
        setMarketLoadStatus('Could not parse market XML (empty response).');
        return;
      }
      rows = xml.getElementsByTagName('row');

      markerLibPromise
        .then(function (lib) {
          var AdvancedMarkerElement = lib.AdvancedMarkerElement;
          var PinElement = lib.PinElement;
          if (!AdvancedMarkerElement || !PinElement) {
            throw new Error('AdvancedMarkerElement/PinElement missing');
          }

          var count = 0;
          Array.prototype.forEach.call(rows, function (row) {
            if (!lacityIsLeafMarketRow(row) || count >= MAX_MARKET_PINS) return;
            var loc = lacityParseLocation1(row.getElementsByTagName('location_1')[0]);
            if (!loc) return;

            var name = marketRowName(row);
            var street = marketRowStreet(row);
            var point = { lat: loc.lat, lng: loc.lng };

            var body = document.createElement('div');
            var strong = document.createElement('strong');
            strong.textContent = name;
            body.appendChild(strong);
            body.appendChild(document.createElement('br'));
            var line = document.createElement('span');
            line.textContent = street;
            body.appendChild(line);

            try {
              var pin = new PinElement({
                background: '#EA4335',
                borderColor: '#C5221F',
                glyphColor: '#fff',
                glyphText: 'M',
              });
              var marker = new AdvancedMarkerElement({
                map: map,
                position: point,
                title: name,
                content: pin,
              });
              marker.addListener('gmp-click', function () {
                marketInfoWindow.setContent(body);
                marketInfoWindow.open({ map: map, anchor: marker });
              });
              count++;
            } catch (e) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('AdvancedMarker failed', name, e);
              }
            }
          });

          marketsReady = true;
          setMarketLoadStatus(
            count > 0
              ? 'Showing ' + count + ' markets on the map (max ' + MAX_MARKET_PINS + ').'
              : 'No market pins: check console / network, or open over http(s) not file://.'
          );
        })
        .catch(function (err) {
          marketsReady = true;
          setMarketLoadStatus('Could not load advanced map markers. Check console.');
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('marker library:', err);
          }
        });
    }

    function loadNeighborhoodLayer() {
      var layer = new google.maps.Data();
      layer.loadGeoJson('Neighborhoods.geojson');
      layer.setStyle(function (feature) {
        return {
          fillColor: coliFillColor(feature.getProperty('COLI')),
          fillOpacity: 0.22,
          strokeColor: '#b3b3b3',
          strokeWeight: 1,
          zIndex: 0,
        };
      });
      layer.addListener('mouseover', function (e) {
        layer.overrideStyle(e.feature, {
          strokeColor: '#2a2a2a',
          strokeWeight: 2,
          zIndex: 2,
        });
      });
      layer.addListener('mouseout', function () {
        layer.revertStyle();
      });
      layer.addListener('click', function (e) {
        var hoodName = e.feature.getProperty('name') || '—';
        var coli = e.feature.getProperty('COLI');
        hoodInfoWindow.setContent(
          '<div style="line-height:1.35;max-width:280px;white-space:normal">' +
            '<strong>' +
            hoodName +
            '</strong><br>' +
            '<span style="font-size:12px;color:#444">Neighborhood council boundary (City of L.A.). ' +
            'Field <code>COLI</code> in this GeoJSON is a legacy dataset value — not live public-health data.</span><br>' +
            '<span style="font-size:12px">COLI: ' +
            (coli !== undefined && coli !== null ? String(coli) : '—') +
            '</span></div>'
        );
        var anchor = new google.maps.MVCObject();
        anchor.set('position', e.latLng);
        hoodInfoWindow.open(map, anchor);
      });
      layer.setMap(map);
    }

    function handleSearchOrigin(latLng, title, viewport) {
      if (!marketsReady || !rows) {
        alert('Market data is still loading. Please wait a few seconds and try again.');
        return;
      }

      searchMarkers.forEach(function (m) {
        m.map = null;
      });
      searchMarkers = [];

      markerLibPromise
        .then(function (lib) {
          var AdvancedMarkerElement = lib.AdvancedMarkerElement;
          var PinElement = lib.PinElement;
          if (!AdvancedMarkerElement || !PinElement) return;
          var pin = new PinElement({
            background: '#1a73e8',
            borderColor: '#1557b0',
            glyphColor: '#fff',
          });
          searchMarkers.push(
            new AdvancedMarkerElement({
              map: map,
              position: latLng,
              title: title || 'Selected place',
              content: pin,
            })
          );
        })
        .catch(function () {});

      if (viewport) {
        map.fitBounds(viewport);
      } else {
        map.setCenter(latLng);
        if (map.getZoom() < 12) map.setZoom(13);
      }

      var origin = latLng.toJSON();
      var destinations = [];
      var destNames = [];
      var destAddresses = [];
      var n = 0;
      Array.prototype.forEach.call(rows, function (row) {
        if (n >= DIST_MATRIX_DEST_CAP) return;
        if (!lacityIsLeafMarketRow(row)) return;
        var loc = lacityParseLocation1(row.getElementsByTagName('location_1')[0]);
        if (!loc) return;
        destinations.push({ lat: loc.lat, lng: loc.lng });
        destNames.push(marketRowName(row));
        destAddresses.push(marketRowStreet(row) || '');
        n++;
      });

      var outputDiv = document.getElementById('output');
      outputDiv.innerHTML =
        '<tr><td colspan="4"><div class="ui active centered inline loader"></div> ' +
        '<span class="ui text">Calculating driving distances…</span></td></tr>';

      if (!destinations.length) {
        outputDiv.innerHTML =
          '<tr><td colspan="4"><div class="ui warning message" style="margin:0;text-align:center">' +
          'No market locations in range to compare. Try again after the map finishes loading.' +
          '</div></td></tr>';
        return;
      }

      if (typeof google.maps.importLibrary !== 'function') {
        outputDiv.innerHTML =
          '<tr><td colspan="4"><div class="ui negative message" style="margin:0;text-align:center">' +
          '<p>Route Matrix requires a current Maps JavaScript API loader (<code>importLibrary</code>).</p>' +
          '</div></td></tr>';
        return;
      }

      google.maps
        .importLibrary('routes')
        .then(function (routesLib) {
          var RouteMatrix = routesLib.RouteMatrix;
          if (!RouteMatrix || typeof RouteMatrix.computeRouteMatrix !== 'function') {
            throw new Error('RouteMatrix.computeRouteMatrix is not available');
          }
          var units =
            google.maps.UnitSystem != null
              ? google.maps.UnitSystem.METRIC
              : 'METRIC';
          return RouteMatrix.computeRouteMatrix({
            origins: [origin],
            destinations: destinations,
            travelMode: 'DRIVING',
            routingPreference: 'TRAFFIC_UNAWARE',
            units: units,
            fields: ['distanceMeters', 'localizedValues', 'condition'],
          });
        })
        .then(function (result) {
          var matrix = result && result.matrix != null ? result.matrix : result;
          var row0 = matrix && matrix.rows && matrix.rows[0];
          var items = row0 && row0.items;
          if (!items || !items.length) {
            throw new Error('Empty route matrix response');
          }
          outputDiv.innerHTML = '';
          appendSortedDistanceRows(
            outputDiv,
            destNames,
            destAddresses,
            routeMatrixItemsAsLegacyElements(items)
          );
        })
        .catch(function (err) {
          outputDiv.innerHTML =
            '<tr><td colspan="4"><div class="ui negative message" style="margin:0;text-align:center">' +
            routeMatrixFailureHtml(err) +
            '</div></td></tr>';
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('RouteMatrix.computeRouteMatrix:', err);
          }
        });
    }

    function placeLocationToLatLng(loc) {
      if (!loc) return null;
      if (typeof loc.lat === 'function') return loc;
      var lat = loc.lat;
      var lng = loc.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return new google.maps.LatLng(lat, lng);
      }
      return null;
    }

    function bindSearchUi() {
      var wrap = document.getElementById('pac-input-wrap');
      if (!wrap) return;

      var attachGeocodeAndGo = function (pac) {
        var geocoder = new google.maps.Geocoder();
        function runGeocodedSearch() {
          var q = (pac.value != null ? String(pac.value) : '').trim();
          if (!q) return;
          geocoder.geocode(
            { address: q, bounds: map.getBounds(), region: 'US' },
            function (results, status) {
              if (status !== 'OK' || !results[0]) {
                alert('Could not find that place. Try a more specific address.');
                return;
              }
              var r = results[0];
              handleSearchOrigin(r.geometry.location, r.formatted_address, r.geometry.viewport);
            }
          );
        }

        var btn = document.getElementById('pac-search-btn');
        if (btn) btn.addEventListener('click', runGeocodedSearch);
      };

      var libPromise =
        typeof google.maps.importLibrary === 'function'
          ? google.maps.importLibrary('places')
          : Promise.resolve(google.maps.places || {});

      libPromise
        .then(function (placesLib) {
          var Ctor = placesLib.PlaceAutocompleteElement || google.maps.places.PlaceAutocompleteElement;
          if (!Ctor) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn(
                'PlaceAutocompleteElement not available. In Google Cloud enable Places API (New) for this key.'
              );
            }
            return;
          }

          var pac = new Ctor({
            requestedRegion: 'us',
            placeholder: 'Address, ZIP, or place…',
          });
          pac.id = 'pac-input';
          wrap.appendChild(pac);

          function syncLocationBias() {
            var b = map.getBounds();
            if (b) pac.locationBias = b;
          }
          map.addListener('bounds_changed', syncLocationBias);
          map.addListener('idle', syncLocationBias);
          syncLocationBias();

          pac.addEventListener('gmp-select', function (event) {
            var pred = event.placePrediction;
            if (!pred) return;
            var place = pred.toPlace();
            place
              .fetchFields({
                fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
              })
              .then(function () {
                var latLng = placeLocationToLatLng(place.location);
                if (!latLng) return;
                var title = place.displayName || place.formattedAddress || 'Selected place';
                handleSearchOrigin(latLng, title, place.viewport);
              })
              .catch(function (err) {
                if (typeof console !== 'undefined' && console.warn) {
                  console.warn('Place fetchFields:', err);
                }
              });
          });

          attachGeocodeAndGo(pac);
        })
        .catch(function (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Could not load places library:', err);
          }
        });
    }

    loadMarkets();
    loadNeighborhoodLayer();
    bindSearchUi();
  }

  global.initAutocomplete = initAutocomplete;

  if (typeof jQuery !== 'undefined') {
    jQuery(function ($) {
      $('a[href*="#"]').on('click', function (e) {
        e.preventDefault();
        var target = $(this).attr('href');
        if (!target || target.length < 2) return;
        var $el = $(target);
        if ($el.length) {
          $('html, body').animate({ scrollTop: $el.offset().top }, 500, 'linear');
        }
      });
    });
  }
})(typeof window !== 'undefined' ? window : this);
