import paramiko

from secret_config import SSH_PASS

def create_ssh_tunnel(ssh_hostname, ssh_username, key_file_path, remote_bind_ip, remote_bind_port):
    # Создаем объект SSH-клиента
    client = paramiko.SSHClient()
    
    # Автоматически добавляем хост в known_hosts
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        private_key = paramiko.RSAKey.from_private_key_file(key_file_path, SSH_PASS)
        print(ssh_username+"@"+ssh_hostname+":22 connection...")
        client.connect(
            hostname=ssh_hostname,
            username=ssh_username,
            pkey=private_key,
            port=22
        )
        print(ssh_username+"@"+ssh_hostname+":22 connected!")
        print(ssh_username+"@"+ssh_hostname+":22 create transport...")
        transport = client.get_transport()
        local_port = remote_bind_port
        local_addr = ('localhost', local_port)
        remote_addr = ('localhost', remote_bind_port)
        channel = transport.open_channel("forwarded-tcpip", remote_addr, local_addr, timeout=10)
        print(f"Туннель успешно создан: {local_addr} -> {remote_addr}")
        return client, transport, channel
    
    except Exception as e:
        print(f'Error establishing SSH tunnel: {e}')
        client.close()