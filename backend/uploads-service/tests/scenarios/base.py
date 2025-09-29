import os
from scripts.scenario_register import register
from scripts import outputs
import variables as v
import requests as rq

def make_headers():
    return  {"Content-Type": "application/json; charset=utf-8"}

@register("Main")
def main():
    user_1 = {"username": "adminTester", "password": "TestPass"}
    user_2 = {"username": "adminTester2", "password": "TestPass"}
    headers_1 = make_headers()
    headers_2 = make_headers()
    register_or_login(user_1, headers_1)
    register_or_login(user_2, headers_2)
    get_access_token(headers_1)
    get_access_token(headers_2)
    image = get_image("Images/sample-city-park-400x300.jpg")
    upload_image(headers_1, image)
    upload_image(headers_2, image)
    image = get_image("Images/sample-clouds-400x300.jpg")
    upload_image(headers_1, image)
    upload_image(headers_2, image)


# Загрузка первого изображения
    image_data_1 = get_image("Images/sample-city-park-400x300.jpg")
    if image_data_1:
        upload_response_1 = upload_image(headers_1, image_data_1)
        outputs.write_result(upload_response_1)
    
    # Загрузка второго изображения тем же пользователем
    image_data_2 = get_image("Images/sample-clouds-400x300.jpg")
    if image_data_2:
        upload_response_2 = upload_image(headers_1, image_data_2)
        outputs.write_result(upload_response_2)
    
    # Второй пользователь загружает те же изображения
    if image_data_1:
        upload_response_3 = upload_image(headers_2, image_data_1)
        outputs.write_result(upload_response_3)
    
    if image_data_2:
        upload_response_4 = upload_image(headers_2, image_data_2)
        outputs.write_result(upload_response_4)


def get_image(path):
    """Читает изображение из файла и возвращает его данные"""
    try:
        if not os.path.exists(path):
            outputs.write_result(f"File not found: {path}")
            return None
        
        with open(path, 'rb') as file:
            image_data = file.read()
        
        filename = os.path.basename(path)
        return {
            'filename': filename,
            'data': image_data,
            'content_type': get_content_type(filename)
        }
    except Exception as e:
        outputs.write_result(f"Error reading image {path}: {str(e)}")
        return None


def upload_image(headers, image):
    """Загружает изображение на сервер"""
    try:
        if not image:
            return type('Obj', (object,), {
                'ok': False, 
                'status_code': 400, 
                'text': 'No image data provided'
            })()
        
        # Получаем токен из заголовков
        token = headers.get("Authorization", "")
        if not token:
            return type('Obj', (object,), {
                'ok': False, 
                'status_code': 401, 
                'text': 'No authorization token provided'
            })()
        
        # Создаем заголовки для загрузки
        upload_headers = {"Authorization": token}
        
        # Подготавливаем файл для отправки
        files = {
            'file': (
                image['filename'], 
                image['data'], 
                image['content_type']
            )
        }
        
        # Отправляем запрос на сервер загрузки
        response = rq.post(
            f"{v.upload_server_url}/uploads",
            headers=upload_headers,
            files=files
        )
        
        return response
        
    except Exception as e:
        return type('Obj', (object,), {
            'ok': False, 
            'status_code': 500, 
            'text': f'Upload error: {str(e)}'
        })()


def get_content_type(filename):
    """Определяет Content-Type на основе расширения файла"""
    extension = os.path.splitext(filename)[1].lower()
    
    content_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp'
    }
    
    return content_types.get(extension, 'application/octet-stream')



def get_access_token(headers):
    headers["Authorization"] = headers["Refresh-Token"]

def register_or_login(user, headers):
    res = register(user, headers)
    outputs.write_result(res)
    res = login(user, headers)
    outputs.write_result(res)
    headers["Refresh-Token"] = res.json()["token"]

def register(user_data, headers) -> rq.Response:
    return rq.post(f"{v.auth_server_url}/auth/register", json=user_data, headers=headers)

def login(user_data, headers) -> rq.Response:
    return rq.post(f"{v.auth_server_url}/auth/login", json=user_data, headers=headers)

def refresh(headers) -> rq.Response:
    return rq.post(f"{v.auth_server_url}/auth/refresh", headers=headers)


