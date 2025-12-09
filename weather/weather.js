/**
 * Weather Dashboard - AWS Lambda + OpenWeather Integration
 * Real-time weather with caching and favorites
 */

const CONFIG = {
    STORAGE_PREFIX: 'weather_',
    // OpenWeather API - Free tier allows 1000 calls/day
    OPENWEATHER_API_KEY: 'YOUR_API_KEY', // Replace with actual key
    OPENWEATHER_URL: 'https://api.openweathermap.org/data/2.5',
    // AWS API Gateway endpoint (when deployed)
    AWS_API_ENDPOINT: 'https://YOUR_API_GATEWAY.execute-api.us-east-2.amazonaws.com/prod',
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
    DEFAULT_CITY: 'Raleigh,NC,US'
};

const state = {
    currentWeather: null,
    forecast: null,
    favorites: [],
    unit: 'imperial', // imperial (F) or metric (C)
    currentCity: null
};

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadSettings();
    loadFavorites();
    setupEventListeners();
    
    // Load default or last city
    const lastCity = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'lastCity') || CONFIG.DEFAULT_CITY;
    fetchWeather(lastCity);
}

function setupEventListeners() {
    // Search
    $('search-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query) fetchWeather(query);
        }
    });
    
    // Location
    $('location-btn').addEventListener('click', getCurrentLocation);
    
    // Refresh
    $('refresh-btn').addEventListener('click', () => {
        if (state.currentCity) fetchWeather(state.currentCity, true);
    });
    
    // Unit toggle
    $('unit-toggle').addEventListener('click', toggleUnit);
    
    // Add favorite
    $('add-favorite-btn').addEventListener('click', addCurrentToFavorites);
}

function loadSettings() {
    const unit = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'unit');
    if (unit) {
        state.unit = unit;
        updateUnitDisplay();
    }
}

function loadFavorites() {
    const stored = localStorage.getItem(CONFIG.STORAGE_PREFIX + 'favorites');
    state.favorites = stored ? JSON.parse(stored) : [];
    renderFavorites();
}

function saveFavorites() {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'favorites', JSON.stringify(state.favorites));
}

// ============================================================
// WEATHER API
// ============================================================
async function fetchWeather(query, forceRefresh = false) {
    showLoading();
    
    try {
        // Check cache first
        const cacheKey = CONFIG.STORAGE_PREFIX + 'cache_' + query.toLowerCase();
        const cached = localStorage.getItem(cacheKey);
        
        if (cached && !forceRefresh) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CONFIG.CACHE_DURATION) {
                displayWeather(data.current);
                displayForecast(data.forecast);
                state.currentCity = query;
                localStorage.setItem(CONFIG.STORAGE_PREFIX + 'lastCity', query);
                return;
            }
        }
        
        // Fetch from API (simulated for demo)
        // In production, this would call AWS API Gateway
        const weatherData = await fetchWeatherData(query);
        const forecastData = await fetchForecastData(query);
        
        // Cache the data
        localStorage.setItem(cacheKey, JSON.stringify({
            data: { current: weatherData, forecast: forecastData },
            timestamp: Date.now()
        }));
        
        state.currentCity = query;
        localStorage.setItem(CONFIG.STORAGE_PREFIX + 'lastCity', query);
        
        displayWeather(weatherData);
        displayForecast(forecastData);
        
    } catch (error) {
        console.error('Weather fetch error:', error);
        toast('Failed to fetch weather data', 'error');
        hideLoading();
    }
}

async function fetchWeatherData(query) {
    // Demo data - replace with actual API call
    // const response = await fetch(`${CONFIG.AWS_API_ENDPOINT}/weather?location=${query}&units=${state.unit}`);
    // return await response.json();
    
    return {
        name: query.split(',')[0],
        country: 'US',
        temp: state.unit === 'imperial' ? 72 : 22,
        feels_like: state.unit === 'imperial' ? 75 : 24,
        humidity: 65,
        wind_speed: state.unit === 'imperial' ? 12 : 19,
        description: 'Partly Cloudy',
        icon: '02d',
        uv_index: 6,
        sunrise: '6:45 AM',
        sunset: '5:30 PM'
    };
}

async function fetchForecastData(query) {
    // Demo data - replace with actual API call
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    
    return Array.from({ length: 5 }, (_, i) => {
        const dayIndex = (today + i + 1) % 7;
        const baseTemp = state.unit === 'imperial' ? 70 : 21;
        return {
            day: days[dayIndex],
            high: baseTemp + Math.floor(Math.random() * 10),
            low: baseTemp - 10 + Math.floor(Math.random() * 5),
            description: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Thunderstorms'][Math.floor(Math.random() * 5)],
            icon: ['01d', '02d', '03d', '10d', '11d'][Math.floor(Math.random() * 5)]
        };
    });
}

// ============================================================
// DISPLAY
// ============================================================
function showLoading() {
    $('weather-loading').classList.remove('hidden');
    $('weather-content').classList.add('hidden');
}

function hideLoading() {
    $('weather-loading').classList.add('hidden');
    $('weather-content').classList.remove('hidden');
}

function displayWeather(data) {
    hideLoading();
    
    state.currentWeather = data;
    
    $('location-name').textContent = data.name + (data.country ? ', ' + data.country : '');
    $('current-date').textContent = formatDate(new Date());
    $('temp-value').textContent = Math.round(data.temp);
    $('weather-description').textContent = data.description;
    $('feels-like').textContent = Math.round(data.feels_like) + '°';
    $('humidity').textContent = data.humidity + '%';
    $('wind-speed').textContent = data.wind_speed + (state.unit === 'imperial' ? ' mph' : ' km/h');
    $('uv-index').textContent = data.uv_index;
    $('sunrise').textContent = data.sunrise;
    $('sunset').textContent = data.sunset;
    
    // Weather icon
    const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@4x.png`;
    $('weather-icon-img').src = iconUrl;
    $('weather-icon-img').alt = data.description;
    
    updateUnitDisplay();
}

function displayForecast(data) {
    state.forecast = data;
    
    $('forecast-grid').innerHTML = data.map(day => `
        <div class="forecast-card">
            <div class="forecast-day">${day.day}</div>
            <div class="forecast-icon">
                <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.description}">
            </div>
            <div class="forecast-temp-range">
                <span class="forecast-high">${Math.round(day.high)}°</span>
                <span class="forecast-low">${Math.round(day.low)}°</span>
            </div>
            <div class="forecast-desc">${day.description}</div>
        </div>
    `).join('');
}

function renderFavorites() {
    const container = $('favorites-grid');
    const emptyState = $('empty-favorites');
    
    if (state.favorites.length === 0) {
        emptyState.classList.remove('hidden');
        container.innerHTML = '';
        container.appendChild(emptyState);
        return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = state.favorites.map((fav, index) => `
        <div class="favorite-card" data-city="${escapeHtml(fav.city)}">
            <button class="btn-remove-favorite" data-index="${index}" aria-label="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div class="favorite-header">
                <span class="favorite-name">${escapeHtml(fav.name)}</span>
            </div>
            <div class="favorite-temp">${fav.temp ? Math.round(fav.temp) + '°' : '--°'}</div>
            <div class="favorite-desc">${fav.description || 'Loading...'}</div>
        </div>
    `).join('');
    
    // Click handlers
    container.querySelectorAll('.favorite-card').forEach(card => {
        card.addEventListener('click', e => {
            if (!e.target.closest('.btn-remove-favorite')) {
                fetchWeather(card.dataset.city);
            }
        });
    });
    
    container.querySelectorAll('.btn-remove-favorite').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            removeFavorite(parseInt(btn.dataset.index));
        });
    });
    
    // Update favorite weather data
    updateFavoritesWeather();
}

async function updateFavoritesWeather() {
    for (const fav of state.favorites) {
        try {
            const data = await fetchWeatherData(fav.city);
            fav.temp = data.temp;
            fav.description = data.description;
        } catch (e) {
            console.error('Error updating favorite:', e);
        }
    }
    saveFavorites();
    
    // Re-render with updated data
    state.favorites.forEach((fav, index) => {
        const card = document.querySelector(`.favorite-card[data-city="${fav.city}"]`);
        if (card) {
            card.querySelector('.favorite-temp').textContent = fav.temp ? Math.round(fav.temp) + '°' : '--°';
            card.querySelector('.favorite-desc').textContent = fav.description || 'Unknown';
        }
    });
}

// ============================================================
// ACTIONS
// ============================================================
function getCurrentLocation() {
    if (!navigator.geolocation) {
        toast('Geolocation not supported', 'error');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async position => {
            const { latitude, longitude } = position.coords;
            // In production, reverse geocode to get city name
            fetchWeather(`${latitude},${longitude}`);
        },
        error => {
            toast('Unable to get location', 'error');
            console.error('Geolocation error:', error);
        }
    );
}

function toggleUnit() {
    state.unit = state.unit === 'imperial' ? 'metric' : 'imperial';
    localStorage.setItem(CONFIG.STORAGE_PREFIX + 'unit', state.unit);
    updateUnitDisplay();
    
    // Refresh current weather with new unit
    if (state.currentCity) {
        fetchWeather(state.currentCity, true);
    }
}

function updateUnitDisplay() {
    $('unit-display').textContent = state.unit === 'imperial' ? '°F' : '°C';
    $$('.temp-unit').forEach(el => {
        el.textContent = state.unit === 'imperial' ? '°F' : '°C';
    });
}

function addCurrentToFavorites() {
    if (!state.currentWeather || !state.currentCity) {
        toast('No city selected', 'error');
        return;
    }
    
    // Check if already in favorites
    if (state.favorites.some(f => f.city.toLowerCase() === state.currentCity.toLowerCase())) {
        toast('Already in favorites', 'error');
        return;
    }
    
    state.favorites.push({
        city: state.currentCity,
        name: state.currentWeather.name,
        temp: state.currentWeather.temp,
        description: state.currentWeather.description
    });
    
    saveFavorites();
    renderFavorites();
    toast('Added to favorites!', 'success');
}

function removeFavorite(index) {
    state.favorites.splice(index, 1);
    saveFavorites();
    renderFavorites();
    toast('Removed from favorites', 'success');
}

// ============================================================
// UTILITIES
// ============================================================
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function toast(message, type = 'success') {
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };
    
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `${icons[type]}<span>${escapeHtml(message)}</span>`;
    
    $('toast-container').appendChild(div);
    
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

console.log('Weather Dashboard loaded - AWS Integration Ready');
