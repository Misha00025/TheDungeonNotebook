import pymysql


class MySQLDB:

    def __init__(self, dbname: str, user: str, password: str, host: str, port: str):
        self._dbname = dbname
        self._user = user
        self._pwd = password
        self._host = host
        self._port = port
        self._connect()
        self.last_row_id = 0

    def _connect(self):
        self.__connection = pymysql.connect(database=self._dbname,
                                            user=self._user,
                                            password=self._pwd,
                                            host=self._host,
                                            charset='utf8',
                                            cursorclass=pymysql.cursors.SSCursor)
        # print(self.__connection.get_server_info())
        self.__cursor = self.__connection.cursor()

    def is_connected(self):
        return self.__connection is not None

    def execute(self, query, data=()):
        try:
            with self.__connection.cursor() as cursor:
                result = cursor.execute(query, data)
                self.last_row_id = cursor.lastrowid
                cursor.close()
                self.__connection.commit()
            return result
        except Exception as err:
            print(err)
            self._connect()
            return None

    def fetchone(self, query, data=()):
        try:
            with self.__connection.cursor() as cursor:
                cursor.execute(query, data)
                result = cursor.fetchone()
                cursor.close()
            return result
        except:
            self._connect()
            return None

    def fetchall(self, query, data=()):
        try:
            with self.__connection.cursor() as cursor:
                cursor.execute(query, data)
                result = cursor.fetchall()
                cursor.close()
            return result
        except:
            self._connect()
            return []
