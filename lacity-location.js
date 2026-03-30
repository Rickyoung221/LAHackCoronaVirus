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
