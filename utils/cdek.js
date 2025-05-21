const fetch = require('node-fetch')

class CdekClient {
  constructor() {
    this.token = null;
    this.expiresAt = 0;
    this.clientId = "AcTI1TYelS8DEp2FnkcCExc1hGTIF7QY";
    this.clientSecret = "4XqgsSzVxcZwxOeQoAFLac4hD6OYdkyv";
  }

  // Получение или рефреш токена
  async getToken() {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    const res = await fetch(
      `https://api.cdek.ru/v2/oauth/token?grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error('CDEK token error');
    const { access_token, expires_in } = await res.json();
    this.token = access_token;
    this.expiresAt = Date.now() + (expires_in - 60) * 1000; // минус 60 сек
    return this.token;
  }

  // Универсальный запрос
  async request(path, opts = {}, retry = true) {
    const token = await this.getToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers
    };
    const res = await fetch(`https://api.cdek.ru/v2/${path}`, {
      ...opts,
      headers
    });
    if (res.status === 401 && retry) {
      this.token = null;
      return this.request(path, opts, false);
    }
    return res;
  }

  // Пример метода для подсказки городов
  async suggestCities(name) {
    const res = await this.request(`location/suggest/cities?country_code=RU&name=${encodeURIComponent(name)}`, { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }
  
  async getOffice(cityCode) {
    const res = await this.request(`deliverypoints?country_code=RU&size=10000&city_code=${encodeURIComponent(cityCode)}`, { method: 'GET' });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }
  
  async getTariffs(cityCode, weight) {
    const body = {
        "from_location": {
            "code": 44,
            "country_code": "RU"
	    },
        "to_location": {
            "code": cityCode,
            "country_code": "RU"
        },
        "packages": [
            {
                "weight": weight
            }
        ]
    }

    const res = await this.request(`calculator/tarifflist`, { method: 'POST', body: JSON.stringify(body) });

    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }
}

const CDEK = new CdekClient()

module.exports = CDEK;