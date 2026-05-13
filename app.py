from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from functools import wraps
import requests
import os
from datetime import datetime
from dotenv import load_dotenv
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для запросов из браузера

# Конфигурация
N8N_WEBHOOK_URL = os.getenv('N8N_WEBHOOK_URL', 'http://localhost:5678/webhook/finchat')
N8N_TIMEOUT = int(os.getenv('N8N_TIMEOUT', '30'))

@app.route('/')
def index():
    """Отдаём главную страницу с Vue.js приложением"""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def proxy_chat_to_n8n():
    """
    Прокси для запросов к n8n.
    Скрывает реальный URL n8n от клиента и добавляет CORS.
    """
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({'error': 'Missing message field'}), 400
        
        user_message = data.get('message')
        user_context = data.get('userContext', {})
        
        logger.info(f"Прокси запрос к n8n: {user_message[:50]}...")
        
        # Формируем запрос к n8n
        n8n_payload = {
            'message': user_message,
            'userContext': user_context,
            'timestamp': datetime.now().isoformat(),
            'source': 'fingrade_flask_proxy'
        }
        
        # Отправляем запрос к n8n
        response = requests.post(
            N8N_WEBHOOK_URL,
            json=n8n_payload,
            timeout=N8N_TIMEOUT,
            headers={'Content-Type': 'application/json'}
        )
        
        # Логируем статус
        logger.info(f"n8n ответил с кодом: {response.status_code}")
        
        if response.status_code == 200:
            # n8n может вернуть JSON или простой текст
            try:
                result = response.json()
                # Пробуем извлечь ответ из разных полей
                ai_response = result.get('output') or result.get('response') or result.get('text') or str(result)
            except:
                ai_response = response.text
            
            return jsonify({
                'success': True,
                'response': ai_response,
                'status': 'online'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'n8n вернул код {response.status_code}',
                'status': 'offline'
            }), 502
            
    except requests.exceptions.Timeout:
        logger.error(f"Timeout при запросе к n8n (>{N8N_TIMEOUT} сек)")
        return jsonify({
            'success': False,
            'error': 'Сервер ИИ не отвечает (таймаут)',
            'status': 'offline'
        }), 504
        
    except requests.exceptions.ConnectionError:
        logger.error(f"Нет соединения с n8n на {N8N_WEBHOOK_URL}")
        return jsonify({
            'success': False,
            'error': 'Не удаётся подключиться к серверу ИИ',
            'status': 'offline'
        }), 503
        
    except Exception as e:
        logger.error(f"Ошибка прокси: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Внутренняя ошибка сервера: {str(e)}',
            'status': 'error'
        }), 500

@app.route('/api/analytics/kfg-trend', methods=['GET'])
def get_kfg_trend():
    """
    API для получения динамики КФГ пользователя.
    Альтернатива прямому запросу из Vue (для сложной аналитики).
    """
    try:
        login = request.args.get('login')
        if not login:
            return jsonify({'error': 'Missing login parameter'}), 400
        
        # Получаем данные из Firestore
        from firebase_admin import initialize_app, credentials, firestore
        
        # Инициализация Firebase Admin (если ещё не инициализирован)
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.getenv('FIREBASE_ADMIN_CRED_PATH', 'serviceAccountKey.json'))
            initialize_app(cred)
        
        db = firestore.client()
        
        # Получаем все snapshot'ы пользователя
        snaps_ref = db.collection('users').document(login).collection('monthly_snapshots')
        docs = snaps_ref.stream()
        
        trend_data = []
        for doc in docs:
            data = doc.to_dict()
            trend_data.append({
                'month': doc.id,
                'kfg': data.get('kfg', 0),
                'income': data.get('income', 0),
                'expenses': data.get('totalExpenses', 0)
            })
        
        # Сортируем по дате
        trend_data.sort(key=lambda x: x['month'])
        
        return jsonify({
            'success': True,
            'data': trend_data,
            'average_kfg': sum(d['kfg'] for d in trend_data) / len(trend_data) if trend_data else 0
        })
        
    except Exception as e:
        logger.error(f"Ошибка аналитики: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка статуса сервера и связи с n8n"""
    n8n_status = 'unknown'
    
    # Проверяем n8n
    try:
        response = requests.get(N8N_WEBHOOK_URL, timeout=5)
        n8n_status = 'online' if response.status_code < 500 else 'offline'
    except:
        n8n_status = 'offline'
    
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'n8n': n8n_status,
        'version': '1.0.0'
    })

if __name__ == '__main__':
    # Получаем порт из переменной окружения или используем 5000
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Запуск Flask сервера на порту {port}")
    logger.info(f"n8n webhook: {N8N_WEBHOOK_URL}")
    
    app.run(debug=debug, host='0.0.0.0', port=port)
