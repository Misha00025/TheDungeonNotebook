import pymysql
import pymysqlpool

class MySQLDB:

    def __init__(self, dbname: str, user: str, password: str, host: str, port: str, max_pool = 2000):
        self._dbname = dbname
        self._user = user
        self._pwd = password
        self._host = host
        self._port = port
        self._connect(max_pool)
        self.last_row_id = 0

    def _connect(self, max_pool):
        config={'host':f'{self._host}', 
                'user':f'{self._user}', 
                'password':f'{self._pwd}', 
                'database':f'{self._dbname}',
                'port':int(self._port), 
                'autocommit':True}
        # self.__connection = pymysql.connect(database=self._dbname,
        #                                     user=self._user,
        #                                     password=self._pwd,
        #                                     host=self._host,
        #                                     port=int(self._port),
        #                                     charset='utf8',
        #                                     cursorclass=pymysql.cursors.SSCursor)
        # print(self.__connection.get_server_info())
        self._pool = pymysqlpool.ConnectionPool(size=10, maxsize=max_pool, pre_create_num=2, name='_pool', **config)

    def is_connected(self):
        return self.__connection is not None

    def execute(self, query, data=()):
        try:
            con = self._pool.get_connection()
            with con.cursor() as cursor:
                result = cursor.execute(query, data)
                self.last_row_id = cursor.lastrowid
                cursor.close()
            return result
        except Exception as err:
            print(err)
            self._connect()
            return None

    def fetchone(self, query, data=()):
        try:
            con = self._pool.get_connection()
            with con.cursor() as cursor:
                cursor.execute(query, data)
                result = cursor.fetchone()
                cursor.close()
            return result
        except Exception as a:
            print(f"Exception: {a}")
            self._connect()
            return None

    def fetchall(self, query, data=()):
        try:
            con = self._pool.get_connection()
            with con.cursor() as cursor:
                cursor.execute(query, data)
                result = cursor.fetchall()
                cursor.close()
            return result
        except:
            self._connect()
            return []
