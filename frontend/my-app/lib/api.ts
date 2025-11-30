import axios from 'axios';


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';


const api = axios.create({
baseURL: API_BASE,
withCredentials: false,
headers: {
'Accept': 'application/json'
}
});


// attach token helper
export function setAuthToken(token?: string | null) {
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
else delete api.defaults.headers.common['Authorization'];
}


export default api;