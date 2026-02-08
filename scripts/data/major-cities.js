/**
 * Major world cities for milestone scanning.
 *
 * Each entry matches the location object shape used throughout the app
 * (name, admin1, country, country_code, latitude, longitude, elevation, timezone).
 * Derived from a curated list of 100 cities spanning 6 continents.
 */

// prettier-ignore
export const MAJOR_CITIES = [
  // United States
  { name: "New York City", admin1: "New York", admin2: "", country: "United States", country_code: "US", latitude: 40.7143, longitude: -74.006, elevation: 0, timezone: "America/New_York" },
  { name: "Los Angeles", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 34.0522, longitude: -118.2437, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Chicago", admin1: "Illinois", admin2: "", country: "United States", country_code: "US", latitude: 41.85, longitude: -87.65, elevation: 0, timezone: "America/Chicago" },
  { name: "Houston", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 29.7633, longitude: -95.3633, elevation: 0, timezone: "America/Chicago" },
  { name: "Phoenix", admin1: "Arizona", admin2: "", country: "United States", country_code: "US", latitude: 33.4484, longitude: -112.074, elevation: 0, timezone: "America/Phoenix" },
  { name: "Philadelphia", admin1: "Pennsylvania", admin2: "", country: "United States", country_code: "US", latitude: 39.9524, longitude: -75.1636, elevation: 0, timezone: "America/New_York" },
  { name: "San Antonio", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 29.4241, longitude: -98.4936, elevation: 0, timezone: "America/Chicago" },
  { name: "San Diego", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 32.7157, longitude: -117.1647, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Dallas", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 32.7831, longitude: -96.8067, elevation: 0, timezone: "America/Chicago" },
  { name: "San Jose", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 37.3394, longitude: -121.895, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Austin", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 30.2672, longitude: -97.7431, elevation: 0, timezone: "America/Chicago" },
  { name: "Jacksonville", admin1: "Florida", admin2: "", country: "United States", country_code: "US", latitude: 30.3322, longitude: -81.6556, elevation: 0, timezone: "America/New_York" },
  { name: "Fort Worth", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 32.7254, longitude: -97.3208, elevation: 0, timezone: "America/Chicago" },
  { name: "Columbus", admin1: "Ohio", admin2: "", country: "United States", country_code: "US", latitude: 39.9612, longitude: -82.9988, elevation: 0, timezone: "America/New_York" },
  { name: "Charlotte", admin1: "North Carolina", admin2: "", country: "United States", country_code: "US", latitude: 35.2271, longitude: -80.8431, elevation: 0, timezone: "America/New_York" },
  { name: "Indianapolis", admin1: "Indiana", admin2: "", country: "United States", country_code: "US", latitude: 39.7684, longitude: -86.158, elevation: 0, timezone: "America/Indiana/Indianapolis" },
  { name: "San Francisco", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 37.7749, longitude: -122.4194, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Seattle", admin1: "Washington", admin2: "", country: "United States", country_code: "US", latitude: 47.6062, longitude: -122.3321, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Denver", admin1: "Colorado", admin2: "", country: "United States", country_code: "US", latitude: 39.7392, longitude: -104.9847, elevation: 0, timezone: "America/Denver" },
  { name: "Washington", admin1: "District of Columbia", admin2: "", country: "United States", country_code: "US", latitude: 38.8951, longitude: -77.0364, elevation: 0, timezone: "America/New_York" },
  { name: "Nashville", admin1: "Tennessee", admin2: "", country: "United States", country_code: "US", latitude: 36.1659, longitude: -86.7844, elevation: 0, timezone: "America/Chicago" },
  { name: "Oklahoma City", admin1: "Oklahoma", admin2: "", country: "United States", country_code: "US", latitude: 35.4676, longitude: -97.5164, elevation: 0, timezone: "America/Chicago" },
  { name: "Boston", admin1: "Massachusetts", admin2: "", country: "United States", country_code: "US", latitude: 42.3584, longitude: -71.0598, elevation: 0, timezone: "America/New_York" },
  { name: "El Paso", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 31.7587, longitude: -106.4869, elevation: 0, timezone: "America/Denver" },
  { name: "Portland", admin1: "Oregon", admin2: "", country: "United States", country_code: "US", latitude: 45.5234, longitude: -122.6762, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Las Vegas", admin1: "Nevada", admin2: "", country: "United States", country_code: "US", latitude: 36.175, longitude: -115.1372, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Memphis", admin1: "Tennessee", admin2: "", country: "United States", country_code: "US", latitude: 35.1495, longitude: -90.049, elevation: 0, timezone: "America/Chicago" },
  { name: "Detroit", admin1: "Michigan", admin2: "", country: "United States", country_code: "US", latitude: 42.3314, longitude: -83.0457, elevation: 0, timezone: "America/Detroit" },
  { name: "Baltimore", admin1: "Maryland", admin2: "", country: "United States", country_code: "US", latitude: 39.2904, longitude: -76.6122, elevation: 0, timezone: "America/New_York" },
  { name: "Milwaukee", admin1: "Wisconsin", admin2: "", country: "United States", country_code: "US", latitude: 43.0389, longitude: -87.9065, elevation: 0, timezone: "America/Chicago" },
  { name: "Albuquerque", admin1: "New Mexico", admin2: "", country: "United States", country_code: "US", latitude: 35.0845, longitude: -106.6511, elevation: 0, timezone: "America/Denver" },
  { name: "Fresno", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 36.7477, longitude: -119.7724, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Tucson", admin1: "Arizona", admin2: "", country: "United States", country_code: "US", latitude: 32.2217, longitude: -110.9265, elevation: 0, timezone: "America/Phoenix" },
  { name: "Sacramento", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 38.5816, longitude: -121.4944, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Kansas City", admin1: "Missouri", admin2: "", country: "United States", country_code: "US", latitude: 39.0997, longitude: -94.5786, elevation: 0, timezone: "America/Chicago" },
  { name: "Mesa", admin1: "Arizona", admin2: "", country: "United States", country_code: "US", latitude: 33.4223, longitude: -111.8226, elevation: 0, timezone: "America/Phoenix" },
  { name: "Atlanta", admin1: "Georgia", admin2: "", country: "United States", country_code: "US", latitude: 33.749, longitude: -84.388, elevation: 0, timezone: "America/New_York" },
  { name: "Omaha", admin1: "Nebraska", admin2: "", country: "United States", country_code: "US", latitude: 41.2563, longitude: -95.9404, elevation: 0, timezone: "America/Chicago" },
  { name: "Colorado Springs", admin1: "Colorado", admin2: "", country: "United States", country_code: "US", latitude: 38.8339, longitude: -104.8214, elevation: 0, timezone: "America/Denver" },
  { name: "Raleigh", admin1: "North Carolina", admin2: "", country: "United States", country_code: "US", latitude: 35.7721, longitude: -78.6386, elevation: 0, timezone: "America/New_York" },
  { name: "Long Beach", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 33.767, longitude: -118.1892, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Virginia Beach", admin1: "Virginia", admin2: "", country: "United States", country_code: "US", latitude: 36.8529, longitude: -75.978, elevation: 0, timezone: "America/New_York" },
  { name: "Miami", admin1: "Florida", admin2: "", country: "United States", country_code: "US", latitude: 25.7743, longitude: -80.1937, elevation: 0, timezone: "America/New_York" },
  { name: "Oakland", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 37.8044, longitude: -122.2708, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Minneapolis", admin1: "Minnesota", admin2: "", country: "United States", country_code: "US", latitude: 44.98, longitude: -93.2638, elevation: 0, timezone: "America/Chicago" },
  { name: "Tulsa", admin1: "Oklahoma", admin2: "", country: "United States", country_code: "US", latitude: 36.154, longitude: -95.9928, elevation: 0, timezone: "America/Chicago" },
  { name: "Bakersfield", admin1: "California", admin2: "", country: "United States", country_code: "US", latitude: 35.3733, longitude: -119.0187, elevation: 0, timezone: "America/Los_Angeles" },
  { name: "Wichita", admin1: "Kansas", admin2: "", country: "United States", country_code: "US", latitude: 37.6922, longitude: -97.3375, elevation: 0, timezone: "America/Chicago" },
  { name: "Arlington", admin1: "Texas", admin2: "", country: "United States", country_code: "US", latitude: 32.7357, longitude: -97.1081, elevation: 0, timezone: "America/Chicago" },
  { name: "Aurora", admin1: "Colorado", admin2: "", country: "United States", country_code: "US", latitude: 39.7294, longitude: -104.8319, elevation: 0, timezone: "America/Denver" },

  // Canada
  { name: "Ottawa", admin1: "", admin2: "", country: "Canada", country_code: "CA", latitude: 45.4166, longitude: -75.698, elevation: 0, timezone: "America/Toronto" },

  // Mexico
  { name: "Mexico City", admin1: "", admin2: "", country: "Mexico", country_code: "MX", latitude: 19.4273, longitude: -99.1419, elevation: 0, timezone: "America/Mexico_City" },

  // Europe
  { name: "London", admin1: "", admin2: "", country: "United Kingdom", country_code: "GB", latitude: 51.5085, longitude: -0.1257, elevation: 0, timezone: "Europe/London" },
  { name: "Paris", admin1: "", admin2: "", country: "France", country_code: "FR", latitude: 48.8534, longitude: 2.3488, elevation: 0, timezone: "Europe/Paris" },
  { name: "Berlin", admin1: "", admin2: "", country: "Germany", country_code: "DE", latitude: 52.5244, longitude: 13.4105, elevation: 0, timezone: "Europe/Berlin" },
  { name: "Rome", admin1: "", admin2: "", country: "Italy", country_code: "IT", latitude: 41.8947, longitude: 12.4811, elevation: 0, timezone: "Europe/Rome" },
  { name: "Madrid", admin1: "", admin2: "", country: "Spain", country_code: "ES", latitude: 40.4165, longitude: -3.7026, elevation: 0, timezone: "Europe/Madrid" },
  { name: "Amsterdam", admin1: "", admin2: "", country: "Netherlands", country_code: "NL", latitude: 52.374, longitude: 4.8897, elevation: 0, timezone: "Europe/Amsterdam" },
  { name: "Brussels", admin1: "", admin2: "", country: "Belgium", country_code: "BE", latitude: 50.8467, longitude: 4.3499, elevation: 0, timezone: "Europe/Brussels" },
  { name: "Vienna", admin1: "", admin2: "", country: "Austria", country_code: "AT", latitude: 48.2064, longitude: 16.3707, elevation: 0, timezone: "Europe/Vienna" },
  { name: "Bern", admin1: "", admin2: "", country: "Switzerland", country_code: "CH", latitude: 46.9481, longitude: 7.4474, elevation: 0, timezone: "Europe/Zurich" },
  { name: "Warsaw", admin1: "", admin2: "", country: "Poland", country_code: "PL", latitude: 52.2298, longitude: 21.0118, elevation: 0, timezone: "Europe/Warsaw" },
  { name: "Prague", admin1: "", admin2: "", country: "Czech Republic", country_code: "CZ", latitude: 50.088, longitude: 14.4208, elevation: 0, timezone: "Europe/Prague" },
  { name: "Budapest", admin1: "", admin2: "", country: "Hungary", country_code: "HU", latitude: 47.498, longitude: 19.0399, elevation: 0, timezone: "Europe/Budapest" },
  { name: "Athens", admin1: "", admin2: "", country: "Greece", country_code: "GR", latitude: 37.9534, longitude: 23.749, elevation: 0, timezone: "Europe/Athens" },
  { name: "Lisbon", admin1: "", admin2: "", country: "Portugal", country_code: "PT", latitude: 38.7169, longitude: -9.1399, elevation: 0, timezone: "Europe/Lisbon" },
  { name: "Dublin", admin1: "", admin2: "", country: "Ireland", country_code: "IE", latitude: 53.3331, longitude: -6.2489, elevation: 0, timezone: "Europe/Dublin" },
  { name: "Oslo", admin1: "", admin2: "", country: "Norway", country_code: "NO", latitude: 59.9127, longitude: 10.7461, elevation: 0, timezone: "Europe/Oslo" },
  { name: "Stockholm", admin1: "", admin2: "", country: "Sweden", country_code: "SE", latitude: 59.3326, longitude: 18.0649, elevation: 0, timezone: "Europe/Stockholm" },
  { name: "Helsinki", admin1: "", admin2: "", country: "Finland", country_code: "FI", latitude: 60.1692, longitude: 24.9402, elevation: 0, timezone: "Europe/Helsinki" },
  { name: "Copenhagen", admin1: "", admin2: "", country: "Denmark", country_code: "DK", latitude: 55.6759, longitude: 12.5655, elevation: 0, timezone: "Europe/Copenhagen" },
  { name: "Moscow", admin1: "", admin2: "", country: "Russia", country_code: "RU", latitude: 55.755, longitude: 37.6218, elevation: 0, timezone: "Europe/Moscow" },

  // Asia
  { name: "Beijing", admin1: "", admin2: "", country: "China", country_code: "CN", latitude: 39.9075, longitude: 116.3972, elevation: 0, timezone: "Asia/Shanghai" },
  { name: "Tokyo", admin1: "", admin2: "", country: "Japan", country_code: "JP", latitude: 35.6895, longitude: 139.6917, elevation: 0, timezone: "Asia/Tokyo" },
  { name: "Seoul", admin1: "", admin2: "", country: "South Korea", country_code: "KR", latitude: 37.5683, longitude: 126.9778, elevation: 0, timezone: "Asia/Seoul" },
  { name: "Delhi", admin1: "", admin2: "", country: "India", country_code: "IN", latitude: 28.6667, longitude: 77.2167, elevation: 0, timezone: "Asia/Kolkata" },
  { name: "Islamabad", admin1: "", admin2: "", country: "Pakistan", country_code: "PK", latitude: 33.7035, longitude: 73.0594, elevation: 0, timezone: "Asia/Karachi" },
  { name: "Dhaka", admin1: "", admin2: "", country: "Bangladesh", country_code: "BD", latitude: 23.7104, longitude: 90.4074, elevation: 0, timezone: "Asia/Dhaka" },
  { name: "Ankara", admin1: "", admin2: "", country: "Turkey", country_code: "TR", latitude: 39.9199, longitude: 32.8543, elevation: 0, timezone: "Europe/Istanbul" },
  { name: "Riyadh", admin1: "", admin2: "", country: "Saudi Arabia", country_code: "SA", latitude: 24.6905, longitude: 46.7096, elevation: 0, timezone: "Asia/Riyadh" },
  { name: "Abu Dhabi", admin1: "", admin2: "", country: "United Arab Emirates", country_code: "AE", latitude: 24.4648, longitude: 54.3618, elevation: 0, timezone: "Asia/Dubai" },
  { name: "Bangkok", admin1: "", admin2: "", country: "Thailand", country_code: "TH", latitude: 13.722, longitude: 100.5252, elevation: 0, timezone: "Asia/Bangkok" },
  { name: "Hanoi", admin1: "", admin2: "", country: "Vietnam", country_code: "VN", latitude: 21.0245, longitude: 105.8412, elevation: 0, timezone: "Asia/Ho_Chi_Minh" },
  { name: "Jakarta", admin1: "", admin2: "", country: "Indonesia", country_code: "ID", latitude: -6.2118, longitude: 106.8416, elevation: 0, timezone: "Asia/Jakarta" },
  { name: "Manila", admin1: "", admin2: "", country: "Philippines", country_code: "PH", latitude: 14.6042, longitude: 120.9822, elevation: 0, timezone: "Asia/Manila" },
  { name: "Singapore", admin1: "", admin2: "", country: "Singapore", country_code: "SG", latitude: 1.2897, longitude: 103.8501, elevation: 0, timezone: "Asia/Singapore" },

  // Africa
  { name: "Cairo", admin1: "", admin2: "", country: "Egypt", country_code: "EG", latitude: 30.0392, longitude: 31.2394, elevation: 0, timezone: "Africa/Cairo" },
  { name: "Cape Town", admin1: "", admin2: "", country: "South Africa", country_code: "ZA", latitude: -33.9258, longitude: 18.4232, elevation: 0, timezone: "Africa/Johannesburg" },
  { name: "Nairobi", admin1: "", admin2: "", country: "Kenya", country_code: "KE", latitude: -1.2833, longitude: 36.8167, elevation: 0, timezone: "Africa/Nairobi" },
  { name: "Abuja", admin1: "", admin2: "", country: "Nigeria", country_code: "NG", latitude: 9.0574, longitude: 7.4898, elevation: 0, timezone: "Africa/Lagos" },
  { name: "Accra", admin1: "", admin2: "", country: "Ghana", country_code: "GH", latitude: 5.556, longitude: -0.1969, elevation: 0, timezone: "Africa/Accra" },
  { name: "Addis Ababa", admin1: "", admin2: "", country: "Ethiopia", country_code: "ET", latitude: 9.025, longitude: 38.7469, elevation: 0, timezone: "Africa/Addis_Ababa" },

  // Oceania
  { name: "Canberra", admin1: "", admin2: "", country: "Australia", country_code: "AU", latitude: -35.2835, longitude: 149.1281, elevation: 0, timezone: "Australia/Sydney" },
  { name: "Wellington", admin1: "", admin2: "", country: "New Zealand", country_code: "NZ", latitude: -41.2866, longitude: 174.7756, elevation: 0, timezone: "Pacific/Auckland" },

  // South America
  { name: "Bras\u00edlia", admin1: "", admin2: "", country: "Brazil", country_code: "BR", latitude: -15.7797, longitude: -47.9297, elevation: 0, timezone: "America/Sao_Paulo" },
  { name: "Buenos Aires", admin1: "", admin2: "", country: "Argentina", country_code: "AR", latitude: -34.6051, longitude: -58.4004, elevation: 0, timezone: "America/Argentina/Buenos_Aires" },
  { name: "Bogot\u00e1", admin1: "", admin2: "", country: "Colombia", country_code: "CO", latitude: 4.6097, longitude: -74.0818, elevation: 0, timezone: "America/Bogota" },
  { name: "Santiago", admin1: "", admin2: "", country: "Chile", country_code: "CL", latitude: -33.4569, longitude: -70.6483, elevation: 0, timezone: "America/Santiago" },
  { name: "Lima", admin1: "", admin2: "", country: "Peru", country_code: "PE", latitude: -12.0432, longitude: -77.0282, elevation: 0, timezone: "America/Lima" },
  { name: "Caracas", admin1: "", admin2: "", country: "Venezuela", country_code: "VE", latitude: 10.488, longitude: -66.8792, elevation: 0, timezone: "America/Caracas" },
];
