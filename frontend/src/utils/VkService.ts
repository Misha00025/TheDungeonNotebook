import { Config, Connect, ConnectEvents } from '@vkontakte/superappkit';

const APP_ID = 51847034;
const HOME_URL = "https://the-dungeon-notebook.ru/login";

export interface VkResponse {
  payload: {
    uuid: string;
    type: string;
    auth: number;
    user: User;
    token: string;
    ttl: number;
    hash: string;
    loadExternalUsers: boolean;
    code_verifier: string;
  }
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  avatar: string;
  avatar_base: null | string; // Assuming it could be a string in some cases.
  phone: string;
}

Config.init({
  appId: APP_ID, // идентификатор приложения
});

export class VkService {
    static oneTapAuth = (handleSuccessLogin: (response: VkResponse) => void) => {
        return Connect.buttonOneTapAuth({
            // Обязательный параметр в который нужно добавить обработчик событий приходящих из SDK
            callback: function(e) {
  
              const type = e.type;

              if (!type) {
                return false;
              }

              console.log(type);
              console.log(e);

              switch (type) {
                case ConnectEvents.OneTapAuthEventsSDK.LOGIN_SUCCESS: // = 'VKSDKOneTapAuthLoginSuccess'
                  handleSuccessLogin(e as unknown as VkResponse);
                  return false
                // Для этих событий нужно открыть полноценный VK ID чтобы
                // пользователь дорегистрировался или подтвердил телефон
                case ConnectEvents.OneTapAuthEventsSDK.FULL_AUTH_NEEDED: //  = 'VKSDKOneTapAuthFullAuthNeeded'
                case ConnectEvents.OneTapAuthEventsSDK.PHONE_VALIDATION_NEEDED: // = 'VKSDKOneTapAuthPhoneValidationNeeded'
                case ConnectEvents.ButtonOneTapAuthEventsSDK.SHOW_LOGIN: // = 'VKSDKButtonOneTapAuthShowLogin'
                    handleSuccessLogin(e as unknown as VkResponse);
                    return false;
                  // return Connect.redirectAuth({ url: HOME_URL }); // url - строка с url, на который будет произведён редирект после авторизации.
                  // state - состояние вашего приложение или любая произвольная строка, которая будет добавлена к url после авторизации.
                // Пользователь перешел по кнопке "Войти другим способом"
                case ConnectEvents.ButtonOneTapAuthEventsSDK.SHOW_LOGIN_OPTIONS: // = 'VKSDKButtonOneTapAuthShowLoginOptions'
                  // Параметр url: ссылка для перехода после авторизации. Должен иметь https схему. Обязательный параметр.
                  console.log(e)
                  return Connect.redirectAuth({ url: HOME_URL });
              }
              console.log('some fail')
              return false;
            },
            // Не обязательный параметр с настройками отображения OneTap
            options: {
              showAlternativeLogin: true, // Отображение кнопки "Войти другим способом"
              displayMode: 'default', // Режим отображения кнопки 'default' | 'name_phone' | 'phone_name'
              buttonStyles: {
                borderRadius: 8, // Радиус скругления кнопок
              },
                
            },
          });
    }
}
