import pymysql
from pymysql.cursors import DictCursor
from pymysqlpool import ConnectionPool
from config import connection_settings

pool = ConnectionPool(**connection_settings)

def execute_query(query, params=None):
	with pool.connection() as conn:
		with conn.cursor(DictCursor) as cursor:
			cursor.execute(query, params)
			result = cursor.fetchall()
			conn.commit()
			return result