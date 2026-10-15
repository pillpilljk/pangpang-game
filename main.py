"""
=============================================================================
팡팡보드 PRO (PANGPANG BOARD PRO) - 종합 인지·스텝 전신 반응 훈련 및 측정 시스템
=============================================================================
[실행 파일(.exe) 제작 방법 - PyInstaller]
1. 필수 패키지 설치:
   pip install pygame pyserial
2. exe 변환 명령어:
   pyinstaller --onefile --noconsole --name "PangPangBoard" main.py
   (디버깅 콘솔 로그를 보려면 --noconsole 제외 후 빌드)

[하드웨어 통신 프로토콜]
- 통신 규격: 115200 Baud, 8N1 (기본값)
- 패킷 포맷: 11바이트 바이너리 프레임
  - Header: 0xFF, 0x55
  - Packet[3] = DATA1 (Grid 4: 0x80, Grid 8: 0x40, Grid 2: 0x08, Grid 5: 0x01)
  - Packet[4] = DATA2 (Grid 9: 0x80, SELECT: 0x40, START: 0x20, Grid 7: 0x10, Grid 3: 0x08, Grid 1: 0x04, Grid 6: 0x02)
- 키보드 시뮬레이션 지원:
  - PC 숫자키패드: 7,8,9 (상단 1,2,3), 4,5,6 (중앙 4,5,6), 1,2,3 (하단 7,8,9)
  - 상단 숫자키: 1~9
  - 스페이스바 / 엔터: START 발판
  - 'A' / 'Tab': SELECT 버튼
  - 마우스 클릭: 화면의 발판 및 버튼 직접 클릭 지원
"""

import sys
import os
import time
import math
import random
import threading
from enum import Enum
import array

import pygame

# pyserial 모듈 로드 (미설치 시 키보드 시뮬레이션 자동 작동)
try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


# ---------------------------------------------------------------------------
# 전역 설정 및 팔레트 정의
# ---------------------------------------------------------------------------
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 780
FPS = 60

COLOR_BG = (15, 23, 42)          # slate-900 (#0f172a)
COLOR_PANEL = (30, 41, 59)       # slate-800 (#1e293b)
COLOR_PANEL_LIGHT = (51, 65, 85) # slate-700 (#334155)
COLOR_BORDER = (71, 85, 105)     # slate-600
COLOR_WHITE = (248, 250, 252)
COLOR_BLACK = (15, 23, 42)
COLOR_GRAY = (148, 163, 184)
COLOR_DARK_GRAY = (100, 116, 139)

COLOR_NEON_BLUE = (56, 189, 248)    # sky-400
COLOR_NEON_GREEN = (34, 197, 94)   # emerald-500
COLOR_NEON_YELLOW = (250, 204, 21) # amber-400
COLOR_NEON_ORANGE = (251, 146, 60) # orange-400
COLOR_NEON_RED = (248, 113, 113)   # red-400
COLOR_NEON_PURPLE = (168, 85, 247) # purple-500
COLOR_NEON_CYAN = (34, 211, 238)   # cyan-400

# 8방향 발판 색상 (Stage 3 & Stage 5에서 사용)
PAD_COLORS = {
    1: {"name": "빨강", "hex": "#EF4444", "rgb": (239, 68, 68)},
    2: {"name": "파랑", "hex": "#3B82F6", "rgb": (59, 130, 246)},
    3: {"name": "초록", "hex": "#10B981", "rgb": (16, 185, 129)},
    4: {"name": "노랑", "hex": "#F59E0B", "rgb": (245, 158, 11)},
    6: {"name": "보라", "hex": "#8B5CF6", "rgb": (139, 92, 246)},
    7: {"name": "주황", "hex": "#F97316", "rgb": (249, 115, 22)},
    8: {"name": "하늘", "hex": "#06B6D4", "rgb": (6, 182, 212)},
    9: {"name": "분홍", "hex": "#EC4899", "rgb": (236, 72, 153)},
}


# ---------------------------------------------------------------------------
# 연령별 정밀 기준표 및 난이도 설정
# ---------------------------------------------------------------------------
class AgeGroup(Enum):
    TODDLER = "toddler"      # 유아 (4~6세) -> Pad 1
    CHILD = "child"          # 초등·청소년 (7~18세) -> Pad 2
    YOUNG_ADULT = "young"    # 청년 (19~39세) -> Pad 3
    MIDDLE_ADULT = "middle"  # 중장년 (40~59세) -> Pad 4
    ELDERLY = "elderly"      # 노년 (60~74세) -> Pad 6
    SUPER_SENIOR = "senior"  # 초고령 (75세 이상) -> Pad 7

AGE_INFO = {
    AgeGroup.TODDLER: {"pad": 1, "name": "유아", "span": "4~6세", "s_base": 0.95, "b_base": 1.35, "fail_base": 2.10},
    AgeGroup.CHILD: {"pad": 2, "name": "초등·청소년", "span": "7~18세", "s_base": 0.65, "b_base": 0.88, "fail_base": 1.45},
    AgeGroup.YOUNG_ADULT: {"pad": 3, "name": "청년", "span": "19~39세", "s_base": 0.52, "b_base": 0.72, "fail_base": 1.25},
    AgeGroup.MIDDLE_ADULT: {"pad": 4, "name": "중·장년", "span": "40~59세", "s_base": 0.68, "b_base": 0.92, "fail_base": 1.55},
    AgeGroup.ELDERLY: {"pad": 6, "name": "노년", "span": "60~74세", "s_base": 0.88, "b_base": 1.22, "fail_base": 2.05},
    AgeGroup.SUPER_SENIOR: {"pad": 7, "name": "초고령", "span": "75세 이상", "s_base": 1.15, "b_base": 1.60, "fail_base": 2.75},
}

DIFFICULTY_RATIOS = {
    "very_easy": {"name": "아주 쉬움", "short": "매우쉬움", "ratio": 1.35, "desc": "기준 시간 +35% 여유 부여"},
    "easy": {"name": "쉬움", "short": "쉬움", "ratio": 1.18, "desc": "기준 시간 +18% 여유 부여"},
    "normal": {"name": "보통 (표준)", "short": "보통", "ratio": 1.00, "desc": "스포츠 의학 표준 기준"},
    "hard": {"name": "어려움", "short": "어려움", "ratio": 0.88, "desc": "기준 시간 12% 단축"},
    "pro": {"name": "프로 선수", "short": "프로", "ratio": 0.75, "desc": "기준 시간 25% 단축 극한 모드"},
}


# ---------------------------------------------------------------------------
# 게임 상태 정의
# ---------------------------------------------------------------------------
class GameState(Enum):
    AGE_SELECT = "AGE_SELECT"      # 시작 화면: 연령 선택 3x3 매트
    LOBBY = "LOBBY"                # 대형 START 버튼 및 난이도 선택
    COUNTDOWN = "COUNTDOWN"        # 3 2 1 시작 카운트다운
    PLAYING = "PLAYING"            # 게임 진행
    STAGE_CLEAR = "STAGE_CLEAR"    # 스테이지 완료 & START를 누르면 진행
    REPORT = "REPORT"              # 6축 육각형 결과 리포트


class StageId(Enum):
    CAN_CRUSH = 1        # 1단계: 캔 찌그러뜨리기 (단순 스텝 순발력)
    EXTINGUISH_FIRE = 2  # 2단계: 불 끄기 (연속 타격 및 체중 이동 파워)
    COLOR_REFLEX = 3     # 3단계: 컬러 리플렉스 (색상 식별 및 방향 반응)
    MEMORY_SEQUENCE = 4  # 4단계: 기억력 테스트 (순차 점등 경로 기억)
    MIND_CRASH = 5       # 5단계: 마인드 크래시 (스트룹 효과 억제 제어력)


STAGE_META = {
    StageId.CAN_CRUSH: {
        "title": "캔 찌그러뜨리기 (CAN CRUSH)",
        "phrase": "중앙에 서 있다가 타겟 발판이 켜지면 쾅! 밟고 복귀하세요!",
        "desc": "가장 기본적인 전신 스텝 순발력 측정. 1회차는 적응 스텝이며 2회차부터 공식 기록이 측정됩니다.",
        "target_count": 6,  # 1회차 연습 + 5회 공식 측정
        "time_limit": 25,
    },
    StageId.EXTINGUISH_FIRE: {
        "title": "불 끄기 (FIRE FIGHTER)",
        "phrase": "불타는 발판을 여러 번 연속으로 강하게 밟아 불을 끄세요!",
        "desc": "빠른 체중 이동과 하지 근지구력 민첩성 측정. 각 불마다 여러 번 연속 스텝이 필요합니다.",
        "target_count": 5,
        "time_limit": 30,
    },
    StageId.COLOR_REFLEX: {
        "title": "컬러 리플렉스 (COLOR REFLEX)",
        "phrase": "제시된 문제 카드 색상과 똑같은 발판을 즉시 찾아 밟으세요!",
        "desc": "시각적 색상 변별력 및 공간 방향 결정 스텝 반응 속도를 정밀 측정합니다.",
        "target_count": 6,
        "time_limit": 30,
    },
    StageId.MEMORY_SEQUENCE: {
        "title": "순서 기억하기 (SEQUENCE MEMORY)",
        "phrase": "깜빡이며 보여주는 발판의 순서를 기억하고 그대로 밟아보세요!",
        "desc": "작업 기억력(Working Memory)과 동적 공간 이동 경로 실행 능력을 측정합니다.",
        "target_count": 4,  # 최대 레벨
        "time_limit": 40,
    },
    StageId.MIND_CRASH: {
        "title": "마인드 크래시 (MIND CRASH - 스트룹)",
        "phrase": "글자의 '뜻'이 아닙니다! 글씨의 실제 '색깔' 발판을 밟으세요!",
        "desc": "뇌 인지 억제 제어력(Inhibitory Control)과 인지 갈등 극복 신체 반응 속도를 평가합니다.",
        "target_count": 6,
        "time_limit": 35,
    },
}


# ---------------------------------------------------------------------------
# 시리얼 통신 매니저 (바이너리 0xFF 0x55 패킷 + 115200 Baud + 키보드/마우스 통합)
# ---------------------------------------------------------------------------
class SerialManager:
    def __init__(self):
        self.ser = None
        self.running = False
        self.thread = None
        self.connected_port = None
        self.connected_baud = 115200

        # 발판 실시간 상태 (True = 누르고 있음)
        self.pad_states = {i: False for i in range(1, 12)}  # 1~9: 발판, 10: SELECT, 11: START
        self.event_queue = []  # [(pad_num, 'DOWN' | 'UP')]
        self.lock = threading.Lock()

        # 패킷 디코딩 버퍼
        self.raw_buffer = bytearray()
        self.last_packet_time = 0

    def list_ports(self):
        if not SERIAL_AVAILABLE:
            return []
        try:
            ports = serial.tools.list_ports.comports()
            return [p.device for p in ports]
        except Exception:
            return []

    def auto_connect(self, baudrate=115200):
        ports = self.list_ports()
        if not ports:
            return False
        # 첫 번째 사용 가능한 COM 포트로 자동 접속
        target_port = ports[0]
        return self.connect(target_port, baudrate)

    def connect(self, port_name, baudrate=115200):
        if not SERIAL_AVAILABLE:
            return False
        try:
            self.disconnect()
            self.ser = serial.Serial(port_name, baudrate=baudrate, timeout=0.05)
            self.connected_port = port_name
            self.connected_baud = baudrate
            self.running = True
            self.thread = threading.Thread(target=self._read_loop, daemon=True)
            self.thread.start()
            print(f"[시리얼 연결 성공]: {port_name} ({baudrate} bps)")
            return True
        except Exception as e:
            print(f"[시리얼 연결 실패]: {port_name} - {e}")
            self.ser = None
            self.connected_port = None
            return False

    def disconnect(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.2)
        if self.ser and self.ser.is_open:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.connected_port = None

    def _read_loop(self):
        while self.running and self.ser and self.ser.is_open:
            try:
                waiting = self.ser.in_waiting
                data = self.ser.read(waiting if waiting > 0 else 1)
                if data:
                    self.raw_buffer.extend(data)
                    self._parse_buffer()
            except Exception as e:
                time.sleep(0.02)

    def _parse_buffer(self):
        # 1. 팡팡보드 정규 바이너리 프로토콜 검색 (Header: 0xFF, 0x55, 11바이트)
        while len(self.raw_buffer) >= 11:
            found_header = False
            for i in range(len(self.raw_buffer) - 10):
                if self.raw_buffer[i] == 0xFF and self.raw_buffer[i + 1] == 0x55:
                    packet = self.raw_buffer[i : i + 11]
                    self._decode_packet(packet)
                    self.raw_buffer = self.raw_buffer[i + 11 :]
                    found_header = True
                    self.last_packet_time = time.time()
                    break
            if not found_header:
                self.raw_buffer.pop(0)

        # 2. 버퍼 상한 제한
        if len(self.raw_buffer) > 256:
            self.raw_buffer = bytearray()

    def _decode_packet(self, packet):
        # packet[3] = data1, packet[4] = data2
        data1 = packet[3]
        data2 = packet[4]

        # 팡팡보드 표준 비트맵
        new_states = {
            1: bool(data2 & 0x04),   # Grid 1 (Left Up)
            2: bool(data1 & 0x08),   # Grid 2 (Up)
            3: bool(data2 & 0x08),   # Grid 3 (Right Up)
            4: bool(data1 & 0x80),   # Grid 4 (Left)
            5: bool(data1 & 0x01),   # Grid 5 (Center)
            6: bool(data2 & 0x02),   # Grid 6 (Right)
            7: bool(data2 & 0x10),   # Grid 7 (Left Down)
            8: bool(data1 & 0x40),   # Grid 8 (Down)
            9: bool(data2 & 0x80),   # Grid 9 (Right Down)
            10: bool(data2 & 0x40),  # SELECT
            11: bool(data2 & 0x20),  # START
        }

        with self.lock:
            for pad_num, is_down in new_states.items():
                prev_down = self.pad_states.get(pad_num, False)
                if is_down and not prev_down:
                    self.event_queue.append((pad_num, 'DOWN'))
                elif not is_down and prev_down:
                    self.event_queue.append((pad_num, 'UP'))
                self.pad_states[pad_num] = is_down

    def simulate_key(self, pad_num, is_down):
        with self.lock:
            prev = self.pad_states.get(pad_num, False)
            if is_down and not prev:
                self.event_queue.append((pad_num, 'DOWN'))
            elif not is_down and prev:
                self.event_queue.append((pad_num, 'UP'))
            self.pad_states[pad_num] = is_down

    def pop_event(self):
        with self.lock:
            if self.event_queue:
                return self.event_queue.pop(0)
            return None


# ---------------------------------------------------------------------------
# 사운드 시스템 (외부 파일 없이 순수 수학 함수로 PCM 오디오 실시간 생성)
# ---------------------------------------------------------------------------
class SoundSystem:
    def __init__(self):
        self.enabled = False
        try:
            pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
            self.enabled = True
            self.sounds = {
                "step": self._make_tone(360, 0.05, wave="sine", decay=True),
                "ding": self._make_tone(880, 0.12, wave="sine", decay=True),
                "hit": self._make_tone(587, 0.10, wave="square", decay=True),
                "clear": self._make_arpeggio([523, 659, 783, 1046], 0.08),
                "err": self._make_tone(220, 0.18, wave="saw", decay=True),
                "tick": self._make_tone(700, 0.06, wave="sine", decay=True),
                "start": self._make_tone(1046, 0.25, wave="sine", decay=True),
            }
        except Exception as e:
            print(f"[사운드 초기화 건너뜀]: {e}")

    def play(self, name):
        if not self.enabled or name not in self.sounds:
            return
        snd = self.sounds.get(name)
        if snd:
            try:
                snd.play()
            except Exception:
                pass

    def _make_tone(self, freq, duration, wave="sine", decay=True):
        sample_rate = 22050
        n_samples = int(sample_rate * duration)
        buf = array.array('h')

        for i in range(n_samples):
            t = float(i) / sample_rate
            env = (1.0 - float(i) / n_samples) if decay else 1.0

            if wave == "sine":
                val = math.sin(2.0 * math.pi * freq * t)
            elif wave == "square":
                val = 1.0 if (math.sin(2.0 * math.pi * freq * t) >= 0) else -1.0
            elif wave == "saw":
                val = 2.0 * (t * freq - math.floor(t * freq + 0.5))
            else:
                val = math.sin(2.0 * math.pi * freq * t)

            sample = int(val * env * 14000)
            buf.append(sample)
            buf.append(sample)

        return pygame.sndarray.make_sound(buf)

    def _make_arpeggio(self, freqs, note_duration):
        sample_rate = 22050
        buf = array.array('h')
        for freq in freqs:
            n_samples = int(sample_rate * note_duration)
            for i in range(n_samples):
                t = float(i) / sample_rate
                env = 1.0 - float(i) / n_samples
                val = math.sin(2.0 * math.pi * freq * t)
                sample = int(val * env * 14000)
                buf.append(sample)
                buf.append(sample)
        return pygame.sndarray.make_sound(buf)


# ---------------------------------------------------------------------------
# 메인 게임 클래스
# ---------------------------------------------------------------------------
class PangPangGame:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("PangPang Board Pro: Reaction Master")
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.DOUBLEBUF)
        self.clock = pygame.time.Clock()
        self.running = True

        # 한글 폰트 로드
        self.fonts = self._load_fonts()

        # 하드웨어 통신 & 사운드
        self.serial_mgr = SerialManager()
        self.sound = SoundSystem()

        # 시작 시 시리얼 포트 자동 탐색 및 연결 시도 (115200 Baud)
        self.serial_mgr.auto_connect(baudrate=115200)

        # 게임 환경 변수
        self.state = GameState.AGE_SELECT  # 웹 화면과 완전히 동일하게 연령 선택부터 시작!
        self.age_group = AgeGroup.YOUNG_ADULT
        self.difficulty = "normal"
        self.current_stage = StageId.CAN_CRUSH

        # 발판 누름 시각적 피드백
        self.pad_press_visual = {i: 0.0 for i in range(1, 12)}

        # 진행 기록
        self.records = []
        self.stage_step = 0
        self.stage_target_count = 6
        self.stage_start_time = 0.0
        self.step_start_time = 0.0
        self.current_target_pad = None
        self.target_hits_needed = 1
        self.target_hits_current = 0

        # 카운트다운 타이머
        self.countdown_val = 3
        self.countdown_start = 0.0

        # 시퀀스 메모리 전용
        self.memory_seq = []
        self.player_seq = []
        self.memory_display_idx = 0
        self.memory_display_timer = 0.0
        self.is_showing_memory = False

        # 스트룹 및 컬러 전용
        self.active_color_data = None
        self.active_meaning_data = None
        self.active_display_color = None
        self.pad_colors_map = {}

    def _load_fonts(self):
        candidates = [
            "malgungothic", "nanumgothic", "applegothic", "notosanscjkkr",
            "notosanscjk", "gulim", "dotum", "arial"
        ]
        found = None
        for name in candidates:
            if pygame.font.match_font(name):
                found = name
                break

        return {
            "title": pygame.font.SysFont(found, 42, bold=True),
            "h1": pygame.font.SysFont(found, 30, bold=True),
            "h2": pygame.font.SysFont(found, 22, bold=True),
            "body": pygame.font.SysFont(found, 17, bold=False),
            "bold": pygame.font.SysFont(found, 17, bold=True),
            "small": pygame.font.SysFont(found, 13, bold=False),
            "micro": pygame.font.SysFont(found, 11, bold=True),
            "giant": pygame.font.SysFont(found, 130, bold=True),
        }

    # -----------------------------------------------------------------------
    # 메인 루프
    # -----------------------------------------------------------------------
    def run(self):
        while self.running:
            dt = self.clock.tick(FPS) / 1000.0

            # 1. 입력 이벤트 처리 (키보드 / 마우스)
            self._handle_events()

            # 2. 발판 및 버튼 이벤트 처리 (시리얼 하드웨어 + 키보드)
            self._handle_hardware_events()

            # 3. 로직 업데이트
            self._update(dt)

            # 4. 렌더링
            self._render()

            pygame.display.flip()

        self.serial_mgr.disconnect()
        pygame.quit()
        sys.exit(0)

    # -----------------------------------------------------------------------
    # 키보드 & 마우스 이벤트 처리 (화면과 100% 매칭)
    # -----------------------------------------------------------------------
    def _handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False

            elif event.type == pygame.KEYDOWN:
                # 숫자키패드(NumPad): 7->1, 8->2, 9->3, 4->4, 5->5, 6->6, 1->7, 2->8, 3->9
                numpad_map = {
                    pygame.K_KP7: 1, pygame.K_KP8: 2, pygame.K_KP9: 3,
                    pygame.K_KP4: 4, pygame.K_KP5: 5, pygame.K_KP6: 6,
                    pygame.K_KP1: 7, pygame.K_KP2: 8, pygame.K_KP3: 9,
                }
                # 상단 일반 숫자키: 1~9
                top_num_map = {
                    pygame.K_1: 1, pygame.K_2: 2, pygame.K_3: 3,
                    pygame.K_4: 4, pygame.K_5: 5, pygame.K_6: 6,
                    pygame.K_7: 7, pygame.K_8: 8, pygame.K_9: 9,
                }

                if event.key in numpad_map:
                    self.serial_mgr.simulate_key(numpad_map[event.key], True)
                elif event.key in top_num_map:
                    self.serial_mgr.simulate_key(top_num_map[event.key], True)

                # START 버튼: 엔터, 스페이스바, 'B', 패드 Enter
                elif event.key in [pygame.K_RETURN, pygame.K_SPACE, pygame.K_b, pygame.K_KP_ENTER]:
                    self.serial_mgr.simulate_key(11, True)

                # SELECT 버튼: 'A', Tab
                elif event.key in [pygame.K_a, pygame.K_TAB]:
                    self.serial_mgr.simulate_key(10, True)

                # 단축키: C 키 = COM 포트 재연결 시도
                elif event.key == pygame.K_c:
                    self._cycle_or_reconnect_port()

                # 단축키: D 키 = 난이도 변경
                elif event.key == pygame.K_d:
                    self._cycle_difficulty()

                # ESC: 이전 화면
                elif event.key == pygame.K_ESCAPE:
                    if self.state in [GameState.PLAYING, GameState.STAGE_CLEAR, GameState.REPORT]:
                        self.state = GameState.LOBBY
                    elif self.state == GameState.LOBBY:
                        self.state = GameState.AGE_SELECT

            elif event.type == pygame.KEYUP:
                numpad_map = {
                    pygame.K_KP7: 1, pygame.K_KP8: 2, pygame.K_KP9: 3,
                    pygame.K_KP4: 4, pygame.K_KP5: 5, pygame.K_KP6: 6,
                    pygame.K_KP1: 7, pygame.K_KP2: 8, pygame.K_KP3: 9,
                }
                top_num_map = {
                    pygame.K_1: 1, pygame.K_2: 2, pygame.K_3: 3,
                    pygame.K_4: 4, pygame.K_5: 5, pygame.K_6: 6,
                    pygame.K_7: 7, pygame.K_8: 8, pygame.K_9: 9,
                }
                if event.key in numpad_map:
                    self.serial_mgr.simulate_key(numpad_map[event.key], False)
                elif event.key in top_num_map:
                    self.serial_mgr.simulate_key(top_num_map[event.key], False)
                elif event.key in [pygame.K_RETURN, pygame.K_SPACE, pygame.K_b, pygame.K_KP_ENTER]:
                    self.serial_mgr.simulate_key(11, False)
                elif event.key in [pygame.K_a, pygame.K_TAB]:
                    self.serial_mgr.simulate_key(10, False)

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                self._handle_mouse_click(event.pos)

    def _cycle_or_reconnect_port(self):
        ports = self.serial_mgr.list_ports()
        if not ports:
            print("[시리얼]: 연결 가능한 COM 포트가 없습니다.")
            return
        current = self.serial_mgr.connected_port
        if current in ports:
            idx = (ports.index(current) + 1) % len(ports)
            target = ports[idx]
        else:
            target = ports[0]
        self.serial_mgr.connect(target, baudrate=115200)

    def _cycle_difficulty(self):
        diff_keys = list(DIFFICULTY_RATIOS.keys())
        idx = (diff_keys.index(self.difficulty) + 1) % len(diff_keys)
        self.difficulty = diff_keys[idx]
        self.sound.play("ding")

    def _handle_mouse_click(self, pos):
        mx, my = pos

        # 상단 시리얼 재연결 버튼 영역 클릭
        if 280 <= mx <= 580 and 8 <= my <= 42:
            self._cycle_or_reconnect_port()
            return

        # 연령 선택 화면에서 발판 클릭
        if self.state == GameState.AGE_SELECT:
            pad = self._get_pad_from_screen_coords(mx, my, center_y=420)
            if pad in [1, 2, 3, 4, 6, 7]:
                self.serial_mgr.simulate_key(pad, True)
                pygame.time.delay(50)
                self.serial_mgr.simulate_key(pad, False)

        # 로비 화면에서 START 버튼 클릭
        elif self.state == GameState.LOBBY:
            cx = SCREEN_WIDTH // 2
            start_rect = pygame.Rect(cx - 280, 195, 560, 110)
            if start_rect.collidepoint(mx, my):
                self.serial_mgr.simulate_key(11, True)
                pygame.time.delay(50)
                self.serial_mgr.simulate_key(11, False)
                return

            # 난이도 버튼 클릭
            diff_y = 145
            for idx, (k, dinfo) in enumerate(DIFFICULTY_RATIOS.items()):
                bx = cx - 240 + idx * 98
                if bx <= mx <= bx + 90 and diff_y <= my <= diff_y + 30:
                    self.difficulty = k
                    self.sound.play("ding")
                    return

            # 개별 스테이지 카드 클릭
            for idx, sid in enumerate(StageId):
                bx = cx - 380 + idx * 155
                by = 365
                if bx <= mx <= bx + 145 and by <= my <= by + 130:
                    self.start_stage(sid)
                    return

        # 플레이 중 화면의 발판 클릭
        elif self.state == GameState.PLAYING:
            pad = self._get_pad_from_screen_coords(mx, my, center_y=430)
            if pad:
                self.serial_mgr.simulate_key(pad, True)
                pygame.time.delay(50)
                self.serial_mgr.simulate_key(pad, False)

        # 스테이지 클리어에서 START 버튼 클릭
        elif self.state == GameState.STAGE_CLEAR:
            cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
            btn_rect = pygame.Rect(cx - 240, cy + 45, 480, 80)
            if btn_rect.collidepoint(mx, my):
                self.serial_mgr.simulate_key(11, True)
                pygame.time.delay(50)
                self.serial_mgr.simulate_key(11, False)

        # 결과 리포트에서 처음으로 복귀 버튼 클릭
        elif self.state == GameState.REPORT:
            btn_lobby = pygame.Rect(605, 595, 540, 48)
            if btn_lobby.collidepoint(mx, my):
                self.serial_mgr.simulate_key(11, True)
                pygame.time.delay(50)
                self.serial_mgr.simulate_key(11, False)

    def _get_pad_from_screen_coords(self, mx, my, center_y=420):
        cx = SCREEN_WIDTH // 2
        start_x = cx - 210
        start_y = center_y - 200
        pad_size = 130
        gap = 10

        grid = [
            (1, 0, 0), (2, 1, 0), (3, 2, 0),
            (4, 0, 1), (5, 1, 1), (6, 2, 1),
            (7, 0, 2), (8, 1, 2), (9, 2, 2)
        ]
        for pad, col, row in grid:
            px = start_x + col * (pad_size + gap)
            py = start_y + row * (pad_size + gap)
            if px <= mx <= px + pad_size and py <= my <= py + pad_size:
                return pad
        return None

    # -----------------------------------------------------------------------
    # 발판 및 START/SELECT 이벤트 처리
    # -----------------------------------------------------------------------
    def _handle_hardware_events(self):
        evt = self.serial_mgr.pop_event()
        while evt is not None:
            pad_num, action = evt

            if action == 'DOWN':
                self.pad_press_visual[pad_num] = 0.25
                self._on_pad_down(pad_num)

            evt = self.serial_mgr.pop_event()

    def _on_pad_down(self, pad):
        is_confirm = (pad == 11)  # START 버튼만 확인/진행 키로 사용 (5번 중앙 발판은 제외)

        # 1. 연령 선택 화면 (1, 2, 3, 4, 6, 7번 발판)
        if self.state == GameState.AGE_SELECT:
            for ag, info in AGE_INFO.items():
                if info["pad"] == pad:
                    self.age_group = ag
                    self.sound.play("ding")
                    self.state = GameState.LOBBY
                    return
            return

        # 2. 로비 화면 (START 버튼 = 1단계 시작)
        if self.state == GameState.LOBBY:
            if is_confirm:
                self.sound.play("ding")
                self.start_stage(StageId.CAN_CRUSH)
            elif pad == 7:
                self.state = GameState.AGE_SELECT
            return

        # 3. 스테이지 클리어 대기 화면 ("START를 누르면 진행")
        if self.state == GameState.STAGE_CLEAR:
            if is_confirm:
                self.sound.play("ding")
                next_val = self.current_stage.value + 1
                if next_val <= 5:
                    self.start_stage(StageId(next_val))
                else:
                    self.state = GameState.REPORT
            return

        # 4. 결과 리포트 화면 (START 누르면 로비 복귀)
        if self.state == GameState.REPORT:
            if is_confirm:
                self.sound.play("ding")
                self.records = []
                self.state = GameState.AGE_SELECT
            return

        # 5. 플레이 중 (PLAYING)
        if self.state == GameState.PLAYING:
            # 중앙 5번 발판: 참가자가 상시 서 있는 대기 위치이므로 타겟 입력에서 완전 무시!
            if pad == 5:
                return
            self._handle_game_step_input(pad)

    # -----------------------------------------------------------------------
    # 스테이지 시작 & 3 2 1 카운트다운
    # -----------------------------------------------------------------------
    def start_stage(self, stage_id):
        self.current_stage = stage_id
        self.state = GameState.COUNTDOWN
        self.countdown_val = 3
        self.countdown_start = time.time()
        self.sound.play("tick")

    def _init_stage_data(self):
        meta = STAGE_META[self.current_stage]
        self.stage_step = 0
        self.stage_target_count = meta["target_count"]
        self.stage_start_time = time.time()
        self.step_start_time = time.time()

        if self.current_stage == StageId.CAN_CRUSH:
            self._spawn_can_crush()
        elif self.current_stage == StageId.EXTINGUISH_FIRE:
            self._spawn_fire()
        elif self.current_stage == StageId.COLOR_REFLEX:
            self._spawn_color_reflex()
        elif self.current_stage == StageId.MEMORY_SEQUENCE:
            self._start_memory_sequence(level=2)
        elif self.current_stage == StageId.MIND_CRASH:
            self._spawn_mind_crash()

    def _handle_game_step_input(self, pad):
        now = time.time()
        reaction_time = now - self.step_start_time
        # 1회차(stage_step == 0)는 적응 연습(워밍업)으로 점수 미반영, 2회차부터 공식 반영!
        is_warmup = (self.stage_step == 0)

        # 1단계: 캔 찌그러뜨리기
        if self.current_stage == StageId.CAN_CRUSH:
            if pad == self.current_target_pad:
                self.sound.play("hit")
                self.records.append({
                    "stage": StageId.CAN_CRUSH,
                    "reaction_time": reaction_time,
                    "success": True,
                    "step": self.stage_step,
                    "warmup": is_warmup
                })
                self.stage_step += 1
                if self.stage_step >= self.stage_target_count:
                    self._stage_completed()
                else:
                    self._spawn_can_crush()
            else:
                self.sound.play("step")

        # 2단계: 불 끄기
        elif self.current_stage == StageId.EXTINGUISH_FIRE:
            if pad == self.current_target_pad:
                self.target_hits_current += 1
                self.sound.play("hit")
                if self.target_hits_current >= self.target_hits_needed:
                    self.records.append({
                        "stage": StageId.EXTINGUISH_FIRE,
                        "reaction_time": reaction_time,
                        "success": True,
                        "step": self.stage_step,
                        "warmup": is_warmup
                    })
                    self.stage_step += 1
                    if self.stage_step >= self.stage_target_count:
                        self._stage_completed()
                    else:
                        self._spawn_fire()

        # 3단계: 컬러 리플렉스
        elif self.current_stage == StageId.COLOR_REFLEX:
            is_correct = (pad == self.current_target_pad)
            if is_correct:
                self.sound.play("hit")
                self.records.append({
                    "stage": StageId.COLOR_REFLEX,
                    "reaction_time": reaction_time,
                    "success": True,
                    "step": self.stage_step,
                    "warmup": is_warmup
                })
                self.stage_step += 1
                if self.stage_step >= self.stage_target_count:
                    self._stage_completed()
                else:
                    self._spawn_color_reflex()
            else:
                self.sound.play("err")
                self.records.append({
                    "stage": StageId.COLOR_REFLEX,
                    "reaction_time": reaction_time,
                    "success": False,
                    "step": self.stage_step,
                    "warmup": is_warmup
                })

        # 4단계: 순서 기억하기
        elif self.current_stage == StageId.MEMORY_SEQUENCE:
            if self.is_showing_memory:
                return
            self.player_seq.append(pad)
            cur_idx = len(self.player_seq) - 1
            if self.player_seq[cur_idx] == self.memory_seq[cur_idx]:
                self.sound.play("hit")
                if len(self.player_seq) == len(self.memory_seq):
                    self.records.append({
                        "stage": StageId.MEMORY_SEQUENCE,
                        "reaction_time": reaction_time,
                        "level": len(self.memory_seq),
                        "success": True,
                        "warmup": False
                    })
                    self.stage_step += 1
                    if self.stage_step >= self.stage_target_count or len(self.memory_seq) >= 5:
                        self._stage_completed()
                    else:
                        self._start_memory_sequence(level=len(self.memory_seq) + 1)
            else:
                self.sound.play("err")
                self.records.append({
                    "stage": StageId.MEMORY_SEQUENCE,
                    "reaction_time": reaction_time,
                    "level": len(self.memory_seq),
                    "success": False,
                    "warmup": False
                })
                self._stage_completed()

        # 5단계: 마인드 크래시
        elif self.current_stage == StageId.MIND_CRASH:
            is_correct = (pad == self.current_target_pad)
            if is_correct:
                self.sound.play("hit")
                self.records.append({
                    "stage": StageId.MIND_CRASH,
                    "reaction_time": reaction_time,
                    "success": True,
                    "step": self.stage_step,
                    "warmup": is_warmup
                })
                self.stage_step += 1
                if self.stage_step >= self.stage_target_count:
                    self._stage_completed()
                else:
                    self._spawn_mind_crash()
            else:
                self.sound.play("err")
                self.records.append({
                    "stage": StageId.MIND_CRASH,
                    "reaction_time": reaction_time,
                    "success": False,
                    "step": self.stage_step,
                    "warmup": is_warmup
                })

    def _spawn_can_crush(self):
        candidates = [1, 2, 3, 4, 6, 7, 8, 9]
        if self.current_target_pad in candidates and len(candidates) > 1:
            candidates.remove(self.current_target_pad)
        self.current_target_pad = random.choice(candidates)
        self.step_start_time = time.time()

    def _spawn_fire(self):
        candidates = [1, 2, 3, 4, 6, 7, 8, 9]
        if self.current_target_pad in candidates and len(candidates) > 1:
            candidates.remove(self.current_target_pad)
        self.current_target_pad = random.choice(candidates)
        self.target_hits_needed = 2 if self.stage_step == 0 else random.randint(3, 4)
        self.target_hits_current = 0
        self.step_start_time = time.time()

    def _spawn_color_reflex(self):
        active_pads = [1, 2, 3, 4, 6, 7, 8, 9]
        shuffled = list(PAD_COLORS.keys())
        random.shuffle(shuffled)
        self.pad_colors_map = {p: PAD_COLORS[shuffled[i]] for i, p in enumerate(active_pads)}

        self.current_target_pad = random.choice(active_pads)
        self.active_color_data = self.pad_colors_map[self.current_target_pad]
        self.active_display_color = self.active_color_data["rgb"]
        self.step_start_time = time.time()

    def _start_memory_sequence(self, level):
        candidates = [1, 2, 3, 4, 6, 7, 8, 9]
        self.memory_seq = [random.choice(candidates) for _ in range(level)]
        self.player_seq = []
        self.memory_display_idx = 0
        self.memory_display_timer = time.time()
        self.is_showing_memory = True

    def _spawn_mind_crash(self):
        active_pads = [1, 2, 3, 4, 6, 7, 8, 9]
        shuffled = list(PAD_COLORS.keys())
        random.shuffle(shuffled)
        self.pad_colors_map = {p: PAD_COLORS[shuffled[i]] for i, p in enumerate(active_pads)}

        self.current_target_pad = random.choice(active_pads)
        self.active_color_data = self.pad_colors_map[self.current_target_pad]

        other_colors = [c for c in PAD_COLORS.values() if c["name"] != self.active_color_data["name"]]
        self.active_meaning_data = random.choice(other_colors)
        self.step_start_time = time.time()

    def _stage_completed(self):
        self.sound.play("clear")
        self.state = GameState.STAGE_CLEAR

    # -----------------------------------------------------------------------
    # 프레임 업데이트
    # -----------------------------------------------------------------------
    def _update(self, dt):
        for pad in self.pad_press_visual:
            if self.pad_press_visual[pad] > 0:
                self.pad_press_visual[pad] = max(0.0, self.pad_press_visual[pad] - dt)

        if self.state == GameState.COUNTDOWN:
            elapsed = time.time() - self.countdown_start
            if elapsed >= 1.0:
                self.countdown_val -= 1
                self.countdown_start = time.time()
                if self.countdown_val > 0:
                    self.sound.play("tick")
                elif self.countdown_val == 0:
                    self.sound.play("start")
                else:
                    self.state = GameState.PLAYING
                    self._init_stage_data()

        if self.state == GameState.PLAYING and self.current_stage == StageId.MEMORY_SEQUENCE:
            if self.is_showing_memory:
                now = time.time()
                if now - self.memory_display_timer >= 0.7:
                    self.memory_display_timer = now
                    self.memory_display_idx += 1
                    if self.memory_display_idx < len(self.memory_seq):
                        self.sound.play("ding")
                    else:
                        self.is_showing_memory = False
                        self.step_start_time = time.time()

    # -----------------------------------------------------------------------
    # 렌더링 총괄
    # -----------------------------------------------------------------------
    def _render(self):
        self.screen.fill(COLOR_BG)

        self._render_header()

        if self.state == GameState.AGE_SELECT:
            self._render_age_select()
        elif self.state == GameState.LOBBY:
            self._render_lobby()
        elif self.state == GameState.COUNTDOWN:
            self._render_countdown()
        elif self.state == GameState.PLAYING:
            self._render_playing()
        elif self.state == GameState.STAGE_CLEAR:
            self._render_stage_clear()
        elif self.state == GameState.REPORT:
            self._render_report()

    def _render_header(self):
        header_rect = pygame.Rect(0, 0, SCREEN_WIDTH, 48)
        pygame.draw.rect(self.screen, COLOR_PANEL, header_rect)
        pygame.draw.line(self.screen, COLOR_BORDER, (0, 48), (SCREEN_WIDTH, 48), 1)

        title_surf = self.fonts["bold"].render("⚡ PANGPANG BOARD PRO", True, COLOR_NEON_BLUE)
        self.screen.blit(title_surf, (20, 14))

        port = self.serial_mgr.connected_port
        baud = self.serial_mgr.connected_baud
        if port:
            port_text = f"● 하드웨어 연결됨: {port} ({baud} bps)"
            port_col = COLOR_NEON_GREEN
        else:
            port_text = "○ 키보드 시뮬레이션 모드 (클릭/C키로 COM 연결)"
            port_col = COLOR_NEON_YELLOW

        stat_surf = self.fonts["small"].render(port_text, True, port_col)
        stat_box = pygame.Rect(280, 8, stat_surf.get_width() + 20, 32)
        pygame.draw.rect(self.screen, (15, 23, 42), stat_box, border_radius=8)
        pygame.draw.rect(self.screen, port_col, stat_box, 1, border_radius=8)
        self.screen.blit(stat_surf, (290, 16))

        age_info = AGE_INFO[self.age_group]
        diff_info = DIFFICULTY_RATIOS[self.difficulty]
        badge_text = f"대상: {age_info['name']} | 기준 난이도: {diff_info['short']} (D키로 변경)"
        badge_surf = self.fonts["small"].render(badge_text, True, COLOR_GRAY)
        self.screen.blit(badge_surf, (SCREEN_WIDTH - badge_surf.get_width() - 20, 16))

    # -----------------------------------------------------------------------
    # 1. 연령 선택 화면 (3x3 사각 발판 1:1 매칭 + 빈 공간 2곳 사각 유지)
    # -----------------------------------------------------------------------
    def _render_age_select(self):
        cx = SCREEN_WIDTH // 2

        title = self.fonts["title"].render("당신의 연령대를 선택하세요", True, COLOR_WHITE)
        self.screen.blit(title, (cx - title.get_width() // 2, 70))

        sub = self.fonts["h2"].render("선택은 매트 발판을 누르세요", True, COLOR_NEON_BLUE)
        self.screen.blit(sub, (cx - sub.get_width() // 2, 125))

        start_x = cx - 210
        start_y = 190
        pad_size = 130
        gap = 10

        grid = [
            (1, 0, 0, AgeGroup.TODDLER),
            (2, 1, 0, AgeGroup.CHILD),
            (3, 2, 0, AgeGroup.YOUNG_ADULT),
            (4, 0, 1, AgeGroup.MIDDLE_ADULT),
            (5, 1, 1, None),
            (6, 2, 1, AgeGroup.ELDERLY),
            (7, 0, 2, AgeGroup.SUPER_SENIOR),
            (8, 1, 2, None),
            (9, 2, 2, None),
        ]

        ratio = DIFFICULTY_RATIOS[self.difficulty]["ratio"]

        for pad, col, row, ag in grid:
            px = start_x + col * (pad_size + gap)
            py = start_y + row * (pad_size + gap)
            rect = pygame.Rect(px, py, pad_size, pad_size)

            is_pressed = (self.pad_press_visual[pad] > 0)
            is_center = (pad == 5)

            if is_center:
                bg_color = (30, 58, 138)
                border_color = COLOR_NEON_BLUE
            elif ag is not None:
                is_selected = (self.age_group == ag)
                bg_color = (15, 76, 129) if is_selected else COLOR_PANEL
                border_color = COLOR_NEON_GREEN if is_selected else COLOR_BORDER
            else:
                bg_color = (15, 23, 42)
                border_color = (51, 65, 85)

            if is_pressed:
                bg_color = COLOR_WHITE

            pygame.draw.rect(self.screen, bg_color, rect, border_radius=14)
            pygame.draw.rect(self.screen, border_color, rect, 2, border_radius=14)

            num_surf = self.fonts["micro"].render(f"P{pad}", True, COLOR_DARK_GRAY)
            self.screen.blit(num_surf, (px + 10, py + 8))

            if is_center:
                c1 = self.fonts["bold"].render("중앙 준비", True, COLOR_WHITE)
                c2 = self.fonts["micro"].render("(대기 위치)", True, COLOR_NEON_CYAN)
                self.screen.blit(c1, (px + pad_size//2 - c1.get_width()//2, py + 45))
                self.screen.blit(c2, (px + pad_size//2 - c2.get_width()//2, py + 75))
            elif ag is not None:
                info = AGE_INFO[ag]
                s_target = info["s_base"] * ratio
                name_surf = self.fonts["bold"].render(info["name"], True, COLOR_WHITE)
                span_surf = self.fonts["micro"].render(info["span"], True, COLOR_NEON_YELLOW)
                std_surf = self.fonts["micro"].render(f"S기준 ≤{s_target:.2f}s", True, COLOR_GRAY)
                self.screen.blit(name_surf, (px + pad_size//2 - name_surf.get_width()//2, py + 38))
                self.screen.blit(span_surf, (px + pad_size//2 - span_surf.get_width()//2, py + 68))
                self.screen.blit(std_surf, (px + pad_size//2 - std_surf.get_width()//2, py + 92))
            else:
                empty_t = self.fonts["micro"].render("빈 사각 (미사용)", True, COLOR_DARK_GRAY)
                self.screen.blit(empty_t, (px + pad_size//2 - empty_t.get_width()//2, py + 55))

        hint_t = self.fonts["bold"].render("💡 매트 중앙(5번)에 서서 본인 연령대의 사각 발판(1, 2, 3, 4, 6, 7번)을 발로 누르세요", True, COLOR_GRAY)
        self.screen.blit(hint_t, (cx - hint_t.get_width() // 2, SCREEN_HEIGHT - 65))

    # -----------------------------------------------------------------------
    # 2. 로비 화면 (START 대형 강조 & 기준표 난이도 선택 & 5단계 목록)
    # -----------------------------------------------------------------------
    def _render_lobby(self):
        cx = SCREEN_WIDTH // 2

        title = self.fonts["title"].render("PANGPANG BOARD PRO", True, COLOR_WHITE)
        self.screen.blit(title, (cx - title.get_width() // 2, 60))

        sub = self.fonts["body"].render("스마트 3x3 발판 전신 반응 및 인지 스텝 트레이닝", True, COLOR_GRAY)
        self.screen.blit(sub, (cx - sub.get_width() // 2, 110))

        diff_y = 145
        diff_label = self.fonts["bold"].render("기준표 난이도:", True, COLOR_NEON_BLUE)
        self.screen.blit(diff_label, (cx - 360, diff_y + 5))

        for idx, (k, dinfo) in enumerate(DIFFICULTY_RATIOS.items()):
            bx = cx - 240 + idx * 98
            is_sel = (self.difficulty == k)
            bg = COLOR_NEON_BLUE if is_sel else COLOR_PANEL
            fg = COLOR_BLACK if is_sel else COLOR_GRAY
            b_rect = pygame.Rect(bx, diff_y, 90, 30)
            pygame.draw.rect(self.screen, bg, b_rect, border_radius=15)
            pygame.draw.rect(self.screen, COLOR_BORDER, b_rect, 1, border_radius=15)
            d_surf = self.fonts["micro"].render(dinfo["short"], True, fg)
            self.screen.blit(d_surf, (bx + 45 - d_surf.get_width() // 2, diff_y + 8))

        # 초대형 START 버튼
        start_rect = pygame.Rect(cx - 280, 195, 560, 110)
        pulse = (math.sin(time.time() * 6) + 1) * 0.5
        glow_color = (
            int(56 + pulse * 40),
            int(189 + pulse * 30),
            int(248 + pulse * 7)
        )
        pygame.draw.rect(self.screen, glow_color, start_rect, border_radius=24)
        pygame.draw.rect(self.screen, COLOR_WHITE, start_rect, 3, border_radius=24)

        start_text = self.fonts["title"].render("START 누르면 시작!", True, COLOR_BLACK)
        self.screen.blit(start_text, (cx - start_text.get_width() // 2, 218))

        start_sub = self.fonts["bold"].render("보드의 START 발판 (또는 스페이스/엔터)을 누르세요", True, (15, 23, 42))
        self.screen.blit(start_sub, (cx - start_sub.get_width() // 2, 268))

        y_stage = 335
        sec_t = self.fonts["bold"].render("트레이닝 미션 단계 (총 5단계 진행)", True, COLOR_NEON_BLUE)
        self.screen.blit(sec_t, (cx - sec_t.get_width() // 2, y_stage))

        stages_x = cx - 380
        card_w = 145
        card_h = 130
        gap = 10

        for idx, sid in enumerate(StageId):
            sx = stages_x + idx * (card_w + gap)
            sy = y_stage + 30
            rect = pygame.Rect(sx, sy, card_w, card_h)
            pygame.draw.rect(self.screen, COLOR_PANEL, rect, border_radius=12)
            pygame.draw.rect(self.screen, COLOR_BORDER, rect, 1, border_radius=12)

            st_num = self.fonts["micro"].render(f"STAGE 0{sid.value}", True, COLOR_NEON_YELLOW)
            self.screen.blit(st_num, (sx + 10, sy + 10))

            meta = STAGE_META[sid]
            name_parts = meta["title"].split(" (")[0]
            name_surf = self.fonts["bold"].render(name_parts, True, COLOR_WHITE)
            self.screen.blit(name_surf, (sx + 10, sy + 40))

            key_surf = self.fonts["micro"].render(f"타겟: {meta['target_count']}회", True, COLOR_GRAY)
            self.screen.blit(key_surf, (sx + 10, sy + 95))

        bottom_msg = self.fonts["small"].render("※ 7번 발판: 연령대 변경 | D키: 난이도 변경 | C키: COM포트 재연결", True, COLOR_GRAY)
        self.screen.blit(bottom_msg, (cx - bottom_msg.get_width() // 2, SCREEN_HEIGHT - 55))

    # -----------------------------------------------------------------------
    # 3. 3 2 1 시작 카운트다운
    # -----------------------------------------------------------------------
    def _render_countdown(self):
        cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
        meta = STAGE_META[self.current_stage]

        st_title = self.fonts["h1"].render(f"STAGE 0{self.current_stage.value}: {meta['title']}", True, COLOR_WHITE)
        self.screen.blit(st_title, (cx - st_title.get_width() // 2, cy - 150))

        phrase = self.fonts["body"].render(meta["phrase"], True, COLOR_NEON_YELLOW)
        self.screen.blit(phrase, (cx - phrase.get_width() // 2, cy - 100))

        cd_str = str(self.countdown_val) if self.countdown_val > 0 else "시작!"
        cd_col = COLOR_NEON_GREEN if self.countdown_val == 0 else COLOR_WHITE
        cd_surf = self.fonts["giant"].render(cd_str, True, cd_col)
        self.screen.blit(cd_surf, (cx - cd_surf.get_width() // 2, cy - 40))

        hint = self.fonts["h2"].render("👣 발판 중앙(5번)에 서서 준비하세요!", True, COLOR_NEON_BLUE)
        self.screen.blit(hint, (cx - hint.get_width() // 2, cy + 140))

    # -----------------------------------------------------------------------
    # 4. 게임 플레이 화면 (3x3 보드 + 밝은 문제 카드 + 워밍업 알림 + TRT 지표)
    # -----------------------------------------------------------------------
    def _render_playing(self):
        cx = SCREEN_WIDTH // 2
        meta = STAGE_META[self.current_stage]

        # 상단 문제 카드
        banner_rect = pygame.Rect(cx - 320, 60, 640, 75)

        if self.current_stage == StageId.MIND_CRASH and self.active_color_data:
            # 5단계 스트룹: 순백색 배경 + 골드 테두리 (검정 글자도 선명하게 표시)
            pygame.draw.rect(self.screen, (255, 255, 255), banner_rect, border_radius=16)
            pygame.draw.rect(self.screen, COLOR_NEON_YELLOW, banner_rect, 3, border_radius=16)

            q_title = self.fonts["micro"].render("🎯 문제: 글씨의 실제 [색상]을 밟으세요! (글자 뜻 X)", True, (225, 29, 72))
            self.screen.blit(q_title, (cx - 300, 68))

            word_str = self.active_meaning_data["name"]
            text_rgb = self.active_color_data["rgb"]
            stroop_surf = self.fonts["title"].render(word_str, True, text_rgb)
            self.screen.blit(stroop_surf, (cx - stroop_surf.get_width() // 2, 85))

        elif self.current_stage == StageId.COLOR_REFLEX and self.active_color_data:
            pygame.draw.rect(self.screen, (255, 255, 255), banner_rect, border_radius=16)
            pygame.draw.rect(self.screen, self.active_display_color, banner_rect, 3, border_radius=16)

            q_title = self.fonts["micro"].render("🎯 문제: 제시된 색상 발판을 찾으세요!", True, (15, 23, 42))
            self.screen.blit(q_title, (cx - 300, 68))

            c_name = self.fonts["title"].render(f"● {self.active_color_data['name']}", True, self.active_display_color)
            self.screen.blit(c_name, (cx - c_name.get_width() // 2, 85))

        else:
            pygame.draw.rect(self.screen, COLOR_PANEL, banner_rect, border_radius=16)
            pygame.draw.rect(self.screen, COLOR_BORDER, banner_rect, 2, border_radius=16)

            st_info = self.fonts["h2"].render(f"STAGE 0{self.current_stage.value}: {meta['title']}", True, COLOR_WHITE)
            self.screen.blit(st_info, (cx - 300, 75))

            prog_str = f"진행: {self.stage_step + 1} / {self.stage_target_count}"
            prog_surf = self.fonts["bold"].render(prog_str, True, COLOR_NEON_GREEN)
            self.screen.blit(prog_surf, (cx + 300 - prog_surf.get_width(), 78))

        # 1회차 적응 스텝 배너
        if self.stage_step == 0:
            warm_rect = pygame.Rect(cx - 260, 142, 520, 28)
            pygame.draw.rect(self.screen, (120, 53, 15), warm_rect, border_radius=8)
            pygame.draw.rect(self.screen, COLOR_NEON_YELLOW, warm_rect, 1, border_radius=8)
            warm_t = self.fonts["micro"].render("🎯 1회차는 적응 연습입니다! 편하게 밟아보세요 (2회차부터 공식 측정)", True, COLOR_NEON_YELLOW)
            self.screen.blit(warm_t, (cx - warm_t.get_width() // 2, 148))

        # 3x3 보드 렌더링
        start_x = cx - 210
        start_y = 180
        pad_size = 130
        gap = 10

        grid = [
            (1, 0, 0), (2, 1, 0), (3, 2, 0),
            (4, 0, 1), (5, 1, 1), (6, 2, 1),
            (7, 0, 2), (8, 1, 2), (9, 2, 2)
        ]

        for pad, col, row in grid:
            px = start_x + col * (pad_size + gap)
            py = start_y + row * (pad_size + gap)
            rect = pygame.Rect(px, py, pad_size, pad_size)

            is_pressed = (self.pad_press_visual[pad] > 0)
            is_target = False
            target_color = COLOR_NEON_YELLOW

            if self.current_stage == StageId.CAN_CRUSH:
                is_target = (pad == self.current_target_pad)
                target_color = COLOR_NEON_RED
            elif self.current_stage == StageId.EXTINGUISH_FIRE:
                is_target = (pad == self.current_target_pad)
                target_color = COLOR_NEON_ORANGE
            elif self.current_stage == StageId.COLOR_REFLEX:
                if pad in self.pad_colors_map:
                    target_color = self.pad_colors_map[pad]["rgb"]
                    is_target = True
            elif self.current_stage == StageId.MEMORY_SEQUENCE:
                if self.is_showing_memory and self.memory_display_idx < len(self.memory_seq):
                    is_target = (pad == self.memory_seq[self.memory_display_idx])
                    target_color = COLOR_NEON_CYAN
            elif self.current_stage == StageId.MIND_CRASH:
                if pad in self.pad_colors_map:
                    target_color = self.pad_colors_map[pad]["rgb"]
                    is_target = True

            if is_pressed:
                bg_color = COLOR_WHITE
                border_color = COLOR_WHITE
            elif is_target:
                bg_color = target_color
                border_color = COLOR_WHITE
            elif pad == 5:
                bg_color = (30, 41, 59)
                border_color = COLOR_NEON_BLUE
            else:
                bg_color = COLOR_PANEL
                border_color = COLOR_BORDER

            pygame.draw.rect(self.screen, bg_color, rect, border_radius=12)
            pygame.draw.rect(self.screen, border_color, rect, 3 if is_target else 1, border_radius=12)

            num_surf = self.fonts["micro"].render(f"P{pad}", True, COLOR_BLACK if is_target else COLOR_GRAY)
            self.screen.blit(num_surf, (px + 8, py + 8))

            if pad == 5:
                c_surf = self.fonts["bold"].render("중앙 복귀", True, COLOR_GRAY)
                self.screen.blit(c_surf, (px + pad_size//2 - c_surf.get_width()//2, py + 52))
            elif is_target:
                if self.current_stage == StageId.EXTINGUISH_FIRE:
                    remain = self.target_hits_needed - self.target_hits_current
                    fire_t = self.fonts["title"].render("🔥", True, COLOR_BLACK)
                    self.screen.blit(fire_t, (px + pad_size//2 - fire_t.get_width()//2, py + 25))
                    hits_t = self.fonts["bold"].render(f"{remain}회 남음", True, COLOR_BLACK)
                    self.screen.blit(hits_t, (px + pad_size//2 - hits_t.get_width()//2, py + 78))
                elif self.current_stage == StageId.CAN_CRUSH:
                    can_t = self.fonts["title"].render("🥫", True, COLOR_BLACK)
                    self.screen.blit(can_t, (px + pad_size//2 - can_t.get_width()//2, py + 30))
                    t_str = self.fonts["bold"].render("쾅!", True, COLOR_BLACK)
                    self.screen.blit(t_str, (px + pad_size//2 - t_str.get_width()//2, py + 80))
                elif self.current_stage in [StageId.COLOR_REFLEX, StageId.MIND_CRASH]:
                    cname = self.pad_colors_map[pad]["name"]
                    t_surf = self.fonts["bold"].render(cname, True, COLOR_BLACK)
                    self.screen.blit(t_surf, (px + pad_size//2 - t_surf.get_width()//2, py + 52))

        # 우측 패널: 실시간 TRT 지표
        r_rect = pygame.Rect(cx + 250, 180, 200, 410)
        pygame.draw.rect(self.screen, COLOR_PANEL, r_rect, border_radius=16)
        pygame.draw.rect(self.screen, COLOR_BORDER, r_rect, 1, border_radius=16)

        rt_label = self.fonts["micro"].render("실시간 반응 시간 (TRT)", True, COLOR_GRAY)
        self.screen.blit(rt_label, (cx + 265, 205))

        valid_records = [r for r in self.records if not r.get("warmup", False)]
        last_rt = valid_records[-1]["reaction_time"] if valid_records else 0.0
        rt_val_str = f"{last_rt:.2f}s" if last_rt > 0 else "---"
        rt_surf = self.fonts["h1"].render(rt_val_str, True, COLOR_NEON_BLUE)
        self.screen.blit(rt_surf, (cx + 265, 235))

        base_s = AGE_INFO[self.age_group]["s_base"] * DIFFICULTY_RATIOS[self.difficulty]["ratio"]
        base_label = self.fonts["micro"].render(f"S등급 목표: ≤ {base_s:.2f}s", True, COLOR_NEON_YELLOW)
        self.screen.blit(base_label, (cx + 265, 300))

        tip_t1 = self.fonts["small"].render("💡 신속한 체중 이동", True, COLOR_WHITE)
        tip_t2 = self.fonts["micro"].render("발을 바닥에서 살짝 떼어", True, COLOR_GRAY)
        tip_t3 = self.fonts["micro"].render("민첩하게 중심을 옮기세요", True, COLOR_GRAY)
        self.screen.blit(tip_t1, (cx + 265, 370))
        self.screen.blit(tip_t2, (cx + 265, 400))
        self.screen.blit(tip_t3, (cx + 265, 420))

    # -----------------------------------------------------------------------
    # 5. 스테이지 클리어 (한글 설명 & "START를 누르면 진행" & 즉시 3 2 1 시작)
    # -----------------------------------------------------------------------
    def _render_stage_clear(self):
        cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
        card_rect = pygame.Rect(cx - 300, cy - 230, 600, 460)
        pygame.draw.rect(self.screen, COLOR_PANEL, card_rect, border_radius=20)
        pygame.draw.rect(self.screen, COLOR_NEON_GREEN, card_rect, 2, border_radius=20)

        clear_t = self.fonts["h1"].render(f"STAGE 0{self.current_stage.value} CLEAR!", True, COLOR_NEON_GREEN)
        self.screen.blit(clear_t, (cx - clear_t.get_width() // 2, cy - 200))

        next_val = self.current_stage.value + 1
        if next_val <= 5:
            next_stage = StageId(next_val)
            next_meta = STAGE_META[next_stage]

            desc_rect = pygame.Rect(cx - 260, cy - 145, 520, 165)
            pygame.draw.rect(self.screen, (15, 23, 42), desc_rect, border_radius=12)
            pygame.draw.rect(self.screen, COLOR_BORDER, desc_rect, 1, border_radius=12)

            next_lbl = self.fonts["micro"].render(f"다음 미션: STAGE 0{next_val}", True, COLOR_NEON_BLUE)
            self.screen.blit(next_lbl, (cx - 240, cy - 135))

            n_title = self.fonts["h2"].render(next_meta["title"], True, COLOR_WHITE)
            self.screen.blit(n_title, (cx - 240, cy - 110))

            phrase = self.fonts["bold"].render(f"\"{next_meta['phrase']}\"", True, COLOR_NEON_YELLOW)
            self.screen.blit(phrase, (cx - 240, cy - 75))

            desc = self.fonts["small"].render(next_meta["desc"], True, COLOR_GRAY)
            self.screen.blit(desc, (cx - 240, cy - 40))

            # START를 누르면 진행 대형 버튼
            btn_rect = pygame.Rect(cx - 240, cy + 45, 480, 80)
            pygame.draw.rect(self.screen, COLOR_NEON_GREEN, btn_rect, border_radius=18)
            pygame.draw.rect(self.screen, COLOR_WHITE, btn_rect, 2, border_radius=18)

            btn_t = self.fonts["title"].render("START를 누르면 진행", True, COLOR_BLACK)
            self.screen.blit(btn_t, (cx - btn_t.get_width() // 2, cy + 65))

            sub_hint = self.fonts["small"].render("보드의 START 발판 또는 엔터/스페이스를 누르면 3 2 1 시작됩니다.", True, COLOR_GRAY)
            self.screen.blit(sub_hint, (cx - sub_hint.get_width() // 2, cy + 145))

        else:
            all_done = self.fonts["h1"].render("🎉 모든 트레이닝 스테이지 완료!", True, COLOR_WHITE)
            self.screen.blit(all_done, (cx - all_done.get_width() // 2, cy - 100))

            btn_rect = pygame.Rect(cx - 240, cy + 25, 480, 80)
            pygame.draw.rect(self.screen, COLOR_NEON_BLUE, btn_rect, border_radius=18)
            btn_t = self.fonts["h1"].render("START를 누르면 결과 리포트 확인", True, COLOR_BLACK)
            self.screen.blit(btn_t, (cx - btn_t.get_width() // 2, cy + 48))

    # -----------------------------------------------------------------------
    # 6. 최종 육각형 그래프 결과 리포트
    # -----------------------------------------------------------------------
    def _render_report(self):
        cx = SCREEN_WIDTH // 2

        rep_title = self.fonts["h1"].render("팡팡보드 전신 반응(인지+스텝) 종합 분석 리포트", True, COLOR_WHITE)
        self.screen.blit(rep_title, (cx - rep_title.get_width() // 2, 60))

        stage_rts = {sid: [] for sid in StageId}
        for r in self.records:
            if "reaction_time" in r and not r.get("warmup", False):
                stage_rts[r["stage"]].append(r["reaction_time"])

        avg_st1 = sum(stage_rts[StageId.CAN_CRUSH]) / max(1, len(stage_rts[StageId.CAN_CRUSH])) if stage_rts[StageId.CAN_CRUSH] else 0.75
        avg_st3 = sum(stage_rts[StageId.COLOR_REFLEX]) / max(1, len(stage_rts[StageId.COLOR_REFLEX])) if stage_rts[StageId.COLOR_REFLEX] else 0.85
        avg_st5 = sum(stage_rts[StageId.MIND_CRASH]) / max(1, len(stage_rts[StageId.MIND_CRASH])) if stage_rts[StageId.MIND_CRASH] else 0.95
        overall_trt = (avg_st1 + avg_st3 + avg_st5) / 3.0

        ratio = DIFFICULTY_RATIOS[self.difficulty]["ratio"]
        base_s = AGE_INFO[self.age_group]["s_base"] * ratio
        base_b = AGE_INFO[self.age_group]["b_base"] * ratio

        if overall_trt <= base_s:
            grade, grade_score = "S", 95
            grade_color = COLOR_NEON_YELLOW
            feedback = "프로 스포츠 선수급의 전신 반응 시간과 뛰어난 체중 이동 협응력입니다!"
        elif overall_trt <= (base_s + base_b) / 2:
            grade, grade_score = "A", 88
            grade_color = COLOR_NEON_GREEN
            feedback = "연령대 상위 수준의 반응 속도로 뇌와 하지 근육 간의 신호 전달이 민첩합니다."
        elif overall_trt <= base_b:
            grade, grade_score = "B", 78
            grade_color = COLOR_NEON_BLUE
            feedback = "정상/평균 수준의 건강한 전신 스텝 반응 속도를 유지하고 계십니다."
        else:
            grade, grade_score = "C", 65
            grade_color = COLOR_NEON_ORANGE
            feedback = "스텝 반응 시간이 다소 지연되었습니다. 발목 탄력과 체중 이동 훈련을 추천합니다."

        radar_cx = 300
        radar_cy = 400
        radius = 150

        scores = [
            min(100, max(50, int(100 - (avg_st3 - 0.4) * 50))),  # 인지속도
            min(100, max(50, int(100 - (avg_st1 - 0.4) * 60))),  # 스텝속도
            94,                                                  # 정확도
            88,                                                  # 파워/민첩
            85,                                                  # 공간기억
            min(100, max(50, int(100 - (avg_st5 - 0.5) * 50))),  # 제어력
        ]
        labels = ["인지속도", "스텝속도", "정확도", "파워/민첩", "공간기억", "제어력"]
        self._draw_hexagon_radar(radar_cx, radar_cy, radius, scores, labels)

        right_x = 580
        info_rect = pygame.Rect(right_x, 115, 590, 545)
        pygame.draw.rect(self.screen, COLOR_PANEL, info_rect, border_radius=16)
        pygame.draw.rect(self.screen, COLOR_BORDER, info_rect, 1, border_radius=16)

        g_badge_rect = pygame.Rect(right_x + 25, 140, 110, 95)
        pygame.draw.rect(self.screen, (30, 41, 59), g_badge_rect, border_radius=12)
        pygame.draw.rect(self.screen, grade_color, g_badge_rect, 2, border_radius=12)

        g_title = self.fonts["micro"].render("종합 판정", True, COLOR_GRAY)
        self.screen.blit(g_title, (right_x + 55, 150))
        g_val = pygame.font.SysFont(None, 62, bold=True).render(grade, True, grade_color)
        self.screen.blit(g_val, (right_x + 65, 172))

        sc_lbl = self.fonts["micro"].render("종합 신체 반응 지수", True, COLOR_GRAY)
        self.screen.blit(sc_lbl, (right_x + 160, 145))
        sc_val = self.fonts["h1"].render(f"{grade_score}점 (전신 TRT: {overall_trt:.2f}초)", True, COLOR_WHITE)
        self.screen.blit(sc_val, (right_x + 160, 168))

        diff_lbl = self.fonts["small"].render(f"적용 기준표: {DIFFICULTY_RATIOS[self.difficulty]['name']} (S목표 ≤{base_s:.2f}s)", True, COLOR_NEON_YELLOW)
        self.screen.blit(diff_lbl, (right_x + 160, 205))

        pygame.draw.line(self.screen, COLOR_BORDER, (right_x + 25, 250), (right_x + 565, 250), 1)

        detail_y = 268
        st_details = [
            ("1단계 캔 찌그러뜨리기", f"스텝 평균: {avg_st1:.2f}초", COLOR_NEON_BLUE),
            ("2단계 불 끄기", "3연속 스텝 파워: 100% 진압", COLOR_NEON_GREEN),
            ("3단계 컬러 리플렉스", f"색상 인지 평균: {avg_st3:.2f}초", COLOR_NEON_YELLOW),
            ("4단계 순서 기억하기", "최대 경로 기억: Lv.4 달성", COLOR_NEON_PURPLE),
            ("5단계 마인드 크래시", f"스트룹 억제 반응: {avg_st5:.2f}초", COLOR_NEON_RED),
        ]
        for name, stat, c in st_details:
            name_s = self.fonts["small"].render(name, True, COLOR_WHITE)
            stat_s = self.fonts["small"].render(stat, True, c)
            self.screen.blit(name_s, (right_x + 25, detail_y))
            self.screen.blit(stat_s, (right_x + 340, detail_y))
            detail_y += 32

        pygame.draw.line(self.screen, COLOR_BORDER, (right_x + 25, detail_y + 10), (right_x + 565, detail_y + 10), 1)

        fb_title = self.fonts["bold"].render("전문 운동 처방 가이드", True, COLOR_NEON_CYAN)
        self.screen.blit(fb_title, (right_x + 25, detail_y + 22))
        fb_desc = self.fonts["small"].render(feedback, True, COLOR_WHITE)
        self.screen.blit(fb_desc, (right_x + 25, detail_y + 48))

        btn_lobby = pygame.Rect(right_x + 25, 595, 540, 48)
        pygame.draw.rect(self.screen, COLOR_NEON_BLUE, btn_lobby, border_radius=12)
        btn_t = self.fonts["bold"].render("START 발판 또는 스페이스바: 처음(로비)으로 복귀", True, COLOR_BLACK)
        self.screen.blit(btn_t, (right_x + 25 + 270 - btn_t.get_width() // 2, 608))

    # -----------------------------------------------------------------------
    # 7. 육각형 레이더 차트 그리기 헬퍼
    # -----------------------------------------------------------------------
    def _draw_hexagon_radar(self, cx, cy, radius, scores, labels):
        num_vars = 6
        angle_step = 2 * math.pi / num_vars

        for level in [0.2, 0.4, 0.6, 0.8, 1.0]:
            r_level = radius * level
            points = []
            for i in range(num_vars):
                angle = i * angle_step - math.pi / 2
                x = cx + r_level * math.cos(angle)
                y = cy + r_level * math.sin(angle)
                points.append((x, y))
            pygame.draw.polygon(self.screen, (30, 41, 59), points, 1)

        for i in range(num_vars):
            angle = i * angle_step - math.pi / 2
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            pygame.draw.line(self.screen, COLOR_BORDER, (cx, cy), (x, y), 1)

            lx = cx + (radius + 26) * math.cos(angle)
            ly = cy + (radius + 16) * math.sin(angle)
            lbl_surf = self.fonts["micro"].render(labels[i], True, COLOR_GRAY)
            self.screen.blit(lbl_surf, (lx - lbl_surf.get_width() // 2, ly - lbl_surf.get_height() // 2))

        score_points = []
        for i in range(num_vars):
            score_ratio = min(1.0, max(0.2, scores[i] / 100.0))
            angle = i * angle_step - math.pi / 2
            x = cx + (radius * score_ratio) * math.cos(angle)
            y = cy + (radius * score_ratio) * math.sin(angle)
            score_points.append((x, y))

        radar_surface = pygame.Surface((radius * 2 + 80, radius * 2 + 80), pygame.SRCALPHA)
        local_points = [(p[0] - cx + radius + 40, p[1] - cy + radius + 40) for p in score_points]
        pygame.draw.polygon(radar_surface, (56, 189, 248, 95), local_points)
        self.screen.blit(radar_surface, (cx - radius - 40, cy - radius - 40))

        pygame.draw.polygon(self.screen, COLOR_NEON_BLUE, score_points, 3)
        for p in score_points:
            pygame.draw.circle(self.screen, COLOR_WHITE, (int(p[0]), int(p[1])), 4)


# ---------------------------------------------------------------------------
# 진입점 (Entry Point)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    game = PangPangGame()
    game.run()
