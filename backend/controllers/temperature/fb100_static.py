"""FB100 static variables"""
EOT = '\x04'    # 데이터 링크 종료 및 초기화
ENQ = '\x05'    # Polling Sequence의 끝을 암시하는 컨트롤 코드
STX = '\x02'    # 텍스트 전송 시작을 알림
ETX = '\x03'    # 텍스트 전송 종료를 알림

ACK = b'\x06'   # 데이터 승인
NAK = b'\x15'   # 데이터 거부


MODEL_LIST = ["PT", "PTH", "LN", "CHL", "CHH", "CHU"]

DATA_LENGTH = 100  # 수신 버퍼 크기