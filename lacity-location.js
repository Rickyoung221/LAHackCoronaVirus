/**
 * Socrata rows.xml is often <response><row>  <!-- wrapper -->
 *   <row>...</row><row>...</row>  <!-- one element per record -->
 * </row></response>
 * Only leaf <row> elements hold location_1 / business_name; skip the wrapper.
 */
function lacityIsLeafMarketRow(row) {
  if (!row) return false;
  for (var c = row.firstElementChild; c; c = c.nextElementSibling) {
    var ln = (c.localName || c.tagName || '').toLowerCase();
    if (ln === 'row') return false;
  }
  return true;
}

/**
 * Parse LA City Socrata XML <location_1>.
 * Legacy: <location_1 latitude="..." longitude="..."/>
 * Current: <location_1>POINT (lng lat)</location_1>
 */
function lacityParseLocation1(el) {
  if (!el) return null;
  var la = el.getAttribute && el.getAttribute('latitude');
  var lo = el.getAttribute && el.getAttribute('longitude');
  if (la != null && lo != null && la !== '' && lo !== '') {
    var lat = parseFloat(la);
    var lng = parseFloat(lo);
    if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng };
  }
  var text = (el.textContent || el.innerText || '').trim();
  var m = text.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (m) {
    var lngW = parseFloat(m[1]);
    var latW = parseFloat(m[2]);
    if (!isNaN(latW) && !isNaN(lngW)) return { lat: latW, lng: lngW };
  }
  return null;
}

/**
 * When the server omits XML MIME type, responseXML may be null; parse responseText.
 */
function lacityParseSocrataXmlFromXhr(req) {
  var xml = req.responseXML;
  if (xml && xml.documentElement) {
    var pe = xml.getElementsByTagName('parsererror');
    if (!pe || !pe.length) return xml;
  }
  var text = req.responseText;
  if (!text) return null;
  try {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    return doc;
  } catch (e) {
    return null;
  }
}
