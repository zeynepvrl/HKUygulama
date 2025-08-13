const React = require('react');
const ReactDOM = require('react-dom/client');
const App = require('./App');
require('./styles.css');

console.log('React uygulaması başlatılıyor...');

try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error('Root element bulunamadı');
    }
    
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        React.createElement(React.StrictMode, null,
            React.createElement(App)
        )
    );
    
    console.log('React uygulaması başarıyla render edildi');
} catch (error) {
    console.error('React render hatası:', error);
    document.body.innerHTML = `
        <div style="padding: 20px; color: red; font-family: Arial;">
            <h2>Uygulama Hatası</h2>
            <p>${error.message}</p>
            <pre>${error.stack}</pre>
        </div>
    `;
} 