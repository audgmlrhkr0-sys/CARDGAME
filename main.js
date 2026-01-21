// 로컬 JPG 이미지 파일 목록 생성 (1.jpg ~ 184.jpg)
function generateImageList() {
    const images = [];
    for (let i = 1; i <= 184; i++) {
        images.push({
            id: i,
            name: `이미지 ${i}`,
            image: `${i}.jpg`
        });
    }
    return images;
}

// 모든 이미지 목록
const allImages = generateImageList();

// 세로 비율 이미지만 필터링 (가로가 긴 이미지 제외)
let verticalImages = [];

// 이미지 비율 확인 함수
function checkImageAspectRatio(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // 세로가 더 긴 이미지 (height > width)만 true 반환
            resolve(img.height > img.width);
        };
        img.onerror = () => {
            // 이미지 로드 실패 시 false 반환
            resolve(false);
        };
        img.src = imageSrc;
    });
}

// 세로 비율 이미지 필터링
async function filterVerticalImages() {
    verticalImages = [];
    const checkPromises = allImages.map(async (img) => {
        const isVertical = await checkImageAspectRatio(img.image);
        if (isVertical) {
            return img;
        }
        return null;
    });
    
    const results = await Promise.all(checkPromises);
    verticalImages = results.filter(img => img !== null);
    console.log(`세로 비율 이미지: ${verticalImages.length}개 발견`);
}

// 챕터 설정
const chapters = [
    { level: 1, pairs: 4, time: 120, gridCols: 4, previewTime: 5 },
    { level: 2, pairs: 8, time: 100, gridCols: 4, previewTime: 5 },
    { level: 3, pairs: 12, time: 60, gridCols: 6, previewTime: 5 },
    { level: 4, pairs: 16, time: 60, gridCols: 8, previewTime: 8 },
    { level: 5, pairs: 20, time: 60, gridCols: 10, previewTime: 8 }
];

// 게임 상태
let gameState = {
    currentChapter: 1,
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    score: 0,
    timeLeft: 120,
    totalTime: 120,
    timerInterval: null,
    previewTimeout: null,
    isProcessing: false,
    gameStarted: false,
    isPreviewMode: false
};

// DOM 요소
const cardsGrid = document.getElementById('cardsGrid');
const scoreElement = document.getElementById('score');
const movesElement = document.getElementById('moves');
const timerElement = document.getElementById('timer');
const chapterElement = document.getElementById('chapter');
const resetBtn = document.getElementById('resetBtn');
const modalResetBtn = document.getElementById('modalResetBtn');
const gameOverModal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');

// 오디오 요소
const bgMusic1 = new Audio('music.mp3');
const bgMusic2 = new Audio('music2.mp3');
const matchSound = new Audio('ok.mp3');

// 배경음악 무한 재생 설정
bgMusic1.loop = true;
bgMusic2.loop = true;

// 현재 재생 중인 배경음악
let currentBgMusic = null;

// 게임 시작 화면 표시 여부
let gameStartedFromButton = false;

// 게임 초기화
function initGame(resetChapter = false, showStartScreen = false) {
    // 타이머 정지
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    // 미리보기 타이머 정지
    if (gameState.previewTimeout) {
        clearTimeout(gameState.previewTimeout);
    }

    // 챕터 리셋
    if (resetChapter) {
        gameState.currentChapter = 1;
        gameState.score = 0;
    }

    const currentChapter = chapters[gameState.currentChapter - 1];
    
    // 게임 상태 리셋
    gameState = {
        ...gameState,
        cards: [],
        flippedCards: [],
        matchedPairs: 0,
        moves: 0,
        timeLeft: currentChapter.time,
        totalTime: currentChapter.time,
        timerInterval: null,
        previewTimeout: null,
        isProcessing: false,
        gameStarted: false,
        isPreviewMode: false
    };

    // UI 업데이트
    updateScore(gameState.score);
    updateMoves(0);
    updateTimer(currentChapter.time);
    updateChapter();
    
    // 모달 숨기기
    gameOverModal.classList.add('hidden');
    
    // 시작 화면 표시 여부 확인
    if (showStartScreen || (!gameStartedFromButton && resetChapter)) {
        startScreen.classList.remove('hidden');
        return; // 게임 시작 버튼을 기다림
    }
    
    // 시작 화면 숨기기
    startScreen.classList.add('hidden');

    // 타이머 섹션 경고 제거
    document.querySelector('.timer-section').classList.remove('warning');

    // 카드 생성
    createCards();
    
    // 배경음악 재생
    if (gameStartedFromButton) {
        updateBackgroundMusic();
    }
    
    // 5초간 카드 미리보기
    showPreview();
}

// 게임 시작 버튼 클릭 핸들러
function startGameFromButton() {
    gameStartedFromButton = true;
    startScreen.classList.add('hidden');
    // 배경음악 재생 시작
    updateBackgroundMusic();
    initGame(true, false);
}

// 챕터 업데이트
function updateChapter() {
    chapterElement.textContent = `Chapter ${gameState.currentChapter}`;
    // 배경음악 변경
    updateBackgroundMusic();
}

// 배경음악 변경
function updateBackgroundMusic() {
    // 현재 재생 중인 음악 정지
    if (currentBgMusic) {
        currentBgMusic.pause();
        currentBgMusic.currentTime = 0;
    }
    
    // 챕터에 따라 음악 선택
    if (gameState.currentChapter <= 2) {
        currentBgMusic = bgMusic1;
    } else {
        currentBgMusic = bgMusic2;
    }
    
    // 새 음악 재생
    currentBgMusic.play().catch(error => {
        console.log('배경음악 재생 실패:', error);
    });
}

// 카드 생성 및 섞기
function createCards() {
    const currentChapter = chapters[gameState.currentChapter - 1];
    const pairsNeeded = currentChapter.pairs;
    
    // 세로 비율 이미지에서 랜덤으로 필요한 개수만 선택
    const availableImages = verticalImages.length > 0 ? verticalImages : allImages;
    const shuffledAll = [...availableImages].sort(() => Math.random() - 0.5);
    const selectedPaintings = shuffledAll.slice(0, pairsNeeded);
    
    if (selectedPaintings.length < pairsNeeded) {
        console.warn(`경고: 필요한 카드 수(${pairsNeeded})보다 세로 비율 이미지가 부족합니다.`);
    }
    
    // 카드 배열 생성 (각 이미지를 2개씩)
    const cardPairs = [...selectedPaintings, ...selectedPaintings].map((painting, index) => ({
        ...painting,
        uniqueId: index
    }));

    // 카드 섞기 (Fisher-Yates 알고리즘)
    for (let i = cardPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    gameState.cards = cardPairs;

    // 그리드 레이아웃 설정 - 최대 10열로 고정 (챕터 5 기준)
    cardsGrid.style.gridTemplateColumns = `repeat(10, 1fr)`;
    
    // 각 챕터별로 카드가 중앙 정렬되도록 계산
    const cols = currentChapter.gridCols;
    const startCol = Math.floor((10 - cols) / 2) + 1; // CSS grid는 1부터 시작

    // 카드 DOM 생성
    cardsGrid.innerHTML = '';
    cardPairs.forEach((card, index) => {
        const cardElement = createCardElement(card, index);
        // 각 카드의 그리드 위치 계산 (중앙 정렬)
        const row = Math.floor(index / cols);
        const col = (index % cols) + startCol;
        cardElement.style.gridColumn = `${col} / ${col + 1}`;
        cardElement.style.gridRow = `${row + 1} / ${row + 2}`;
        cardsGrid.appendChild(cardElement);
    });
}

// 카드 미리보기 (챕터별 시간)
function showPreview() {
    // 이전 미리보기 타이머가 있다면 취소
    if (gameState.previewTimeout) {
        clearTimeout(gameState.previewTimeout);
        console.log('⚠️ 이전 미리보기 타이머 취소됨');
    }
    
    const currentChapter = chapters[gameState.currentChapter - 1];
    const previewSeconds = currentChapter.previewTime;
    const previewTime = previewSeconds * 1000; // 초를 밀리초로 변환
    
    const startTime = Date.now();
    
    console.log(`=== 챕터 ${gameState.currentChapter} 미리보기 시작 ===`);
    console.log(`설정된 시간: ${previewSeconds}초 (${previewTime}ms)`);
    console.log(`시작 시각:`, new Date().toLocaleTimeString());
    
    gameState.isPreviewMode = true;
    gameState.isProcessing = true;
    
    // 모든 카드 뒤집기
    Array.from(cardsGrid.children).forEach(card => {
        card.classList.add('flipped');
    });
    
    // 설정된 시간 후 카드 다시 뒤집기
    gameState.previewTimeout = setTimeout(() => {
        const endTime = Date.now();
        const actualTime = (endTime - startTime) / 1000;
        
        console.log(`=== 미리보기 종료 ===`);
        console.log(`종료 시각:`, new Date().toLocaleTimeString());
        console.log(`실제 경과 시간: ${actualTime.toFixed(2)}초`);
        console.log(`설정 시간과의 차이: ${Math.abs(actualTime - previewSeconds).toFixed(2)}초`);
        
        Array.from(cardsGrid.children).forEach(card => {
            card.classList.remove('flipped');
        });
        gameState.isPreviewMode = false;
        gameState.isProcessing = false;
        gameState.previewTimeout = null;
    }, previewTime);
}

// 카드 요소 생성
function createCardElement(card, index) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.dataset.index = index;
    cardDiv.dataset.id = card.id;

    cardDiv.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                <img src="${card.image}" alt="${card.name}">
            </div>
            <div class="card-back"></div>
        </div>
    `;

    cardDiv.addEventListener('click', () => handleCardClick(index));

    return cardDiv;
}

// 카드 클릭 처리
function handleCardClick(index) {
    // 게임 시작 (첫 클릭)
    if (!gameState.gameStarted) {
        startTimer();
        gameState.gameStarted = true;
    }

    // 클릭 불가 조건
    if (gameState.isProcessing) return;
    
    const cardElement = cardsGrid.children[index];
    
    if (cardElement.classList.contains('flipped') || 
        cardElement.classList.contains('matched')) {
        return;
    }

    // 카드 뒤집기
    flipCard(index);

    gameState.flippedCards.push(index);

    // 2장의 카드가 뒤집혔을 때
    if (gameState.flippedCards.length === 2) {
        gameState.isProcessing = true;
        updateMoves(gameState.moves + 1);
        checkMatch();
    }
}

// 카드 뒤집기
function flipCard(index) {
    const cardElement = cardsGrid.children[index];
    cardElement.classList.add('flipped');
}

// 카드 뒤집기 취소
function unflipCard(index) {
    const cardElement = cardsGrid.children[index];
    cardElement.classList.remove('flipped');
}

// 매칭 확인
function checkMatch() {
    const [firstIndex, secondIndex] = gameState.flippedCards;
    const firstCard = gameState.cards[firstIndex];
    const secondCard = gameState.cards[secondIndex];

    setTimeout(() => {
        if (firstCard.id === secondCard.id) {
            // 매칭 성공
            handleMatch(firstIndex, secondIndex);
        } else {
            // 매칭 실패
            handleMismatch(firstIndex, secondIndex);
        }

        gameState.flippedCards = [];
        gameState.isProcessing = false;
    }, 1000);
}

// 매칭 성공 처리
function handleMatch(firstIndex, secondIndex) {
    const firstCard = cardsGrid.children[firstIndex];
    const secondCard = cardsGrid.children[secondIndex];

    firstCard.classList.add('matched');
    secondCard.classList.add('matched');

    // 매칭 성공 효과음 재생
    matchSound.currentTime = 0;
    matchSound.play().catch(error => {
        console.log('효과음 재생 실패:', error);
    });

    // 0.5초 후 카드 사라지기
    setTimeout(() => {
        firstCard.style.opacity = '0';
        secondCard.style.opacity = '0';
        
        setTimeout(() => {
            firstCard.style.visibility = 'hidden';
            secondCard.style.visibility = 'hidden';
        }, 300);
    }, 500);

    gameState.matchedPairs++;
    
    // 남은 시간에 따른 보너스 점수
    const timeBonus = Math.floor(gameState.timeLeft * 2);
    updateScore(gameState.score + 100 + timeBonus);

    const currentChapter = chapters[gameState.currentChapter - 1];
    
    // 모든 카드를 맞췄을 때
    if (gameState.matchedPairs === currentChapter.pairs) {
        endGame(true);
    }
}

// 매칭 실패 처리
function handleMismatch(firstIndex, secondIndex) {
    unflipCard(firstIndex);
    unflipCard(secondIndex);
}

// 타이머 시작
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateTimer(gameState.timeLeft);

        // 10초 남았을 때 경고
        if (gameState.timeLeft === 10) {
            document.querySelector('.timer-section').classList.add('warning');
        }

        // 시간 종료
        if (gameState.timeLeft <= 0) {
            endGame(false);
        }
    }, 1000);
}

// 게임 종료
function endGame(isWin) {
    clearInterval(gameState.timerInterval);
    gameState.gameStarted = false;

    setTimeout(() => {
        if (isWin) {
            // 마지막 챕터 완료
            if (gameState.currentChapter === 5) {
                modalTitle.textContent = '🎉 축하합니다! 🎉';
                modalMessage.textContent = `모든 챕터를 클리어했습니다!\n\n최종 스코어: ${gameState.score}\n총 시도 횟수: ${gameState.moves}\n\n━━━━━━━━━━━━━━━━━━━━\n\n📍 경북대미술관\n\n주소: 대구광역시 북구 산격동 1370-1\n      IM뱅크문화센터 2층\n\n연락처: 053-950-7968\n\n운영시간:\n월요일 ~ 토요일: 10:00 ~ 18:00\n일요일 및 공휴일: 휴관`;
                modalResetBtn.textContent = '처음부터 다시하기';
            } else {
                // 다음 챕터로
                modalTitle.textContent = `🎉 Chapter ${gameState.currentChapter} 완료! 🎉`;
                modalMessage.textContent = `축하합니다!\n\n현재 스코어: ${gameState.score}\n시도 횟수: ${gameState.moves}\n남은 시간: ${gameState.timeLeft}초`;
                modalResetBtn.textContent = '다음 챕터';
                
                // 다음 챕터로 자동 진행
                gameState.currentChapter++;
            }
        } else {
            modalTitle.textContent = '💣 폭탄 폭발! 💥';
            const currentChapter = chapters[gameState.currentChapter - 1];
            modalMessage.textContent = `시간이 다 되었습니다!\n\n맞춘 카드: ${gameState.matchedPairs}/${currentChapter.pairs}\n스코어: ${gameState.score}\n시도 횟수: ${gameState.moves}`;
            modalResetBtn.textContent = '다시 도전';
        }
        gameOverModal.classList.remove('hidden');
    }, 1000);
}

// UI 업데이트 함수들
function updateScore(score) {
    gameState.score = score;
    scoreElement.textContent = score;
}

function updateMoves(moves) {
    gameState.moves = moves;
    movesElement.textContent = moves;
}

function updateTimer(seconds) {
    gameState.timeLeft = seconds;
    timerElement.textContent = `${seconds}초`;
    
    // 폭탄 심지 바 애니메이션 (너비 업데이트)
    const percentage = (seconds / gameState.totalTime) * 100;
    const fuseBar = document.getElementById('fuseBar');
    if (fuseBar) {
        fuseBar.style.width = `${percentage}%`;
    }
}

// 이벤트 리스너
resetBtn.addEventListener('click', () => initGame(true));
modalResetBtn.addEventListener('click', () => {
    // 게임 완료 후 처음부터
    if (gameState.currentChapter > 5 || modalResetBtn.textContent === '다시 도전' || modalResetBtn.textContent === '처음부터 다시하기') {
        initGame(true);
    } else {
        // 다음 챕터
        initGame(false);
    }
});

// 테스트용 단축키: Q 키로 다음 챕터
document.addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'Q') {
        if (gameState.currentChapter <= 5) {
            // 타이머 정지
            if (gameState.timerInterval) {
                clearInterval(gameState.timerInterval);
            }
            // 다음 챕터로
            if (gameState.currentChapter === 5) {
                // 챕터 5 완료 처리
                endGame(true);
                console.log('🎮 테스트 모드: 게임 완료');
            } else {
                gameState.currentChapter++;
                initGame(false);
                console.log(`🎮 테스트 모드: Chapter ${gameState.currentChapter}로 이동`);
            }
        } else {
            console.log('⚠️ 이미 마지막 챕터입니다.');
        }
    }
});

// 게임 시작 - 이미지 필터링 후 초기화
async function startGame() {
    // 세로 비율 이미지 필터링
    await filterVerticalImages();
    // 게임 초기화 (시작 화면 표시)
    initGame(true, true);
}

// 게임 시작 버튼 이벤트
startBtn.addEventListener('click', startGameFromButton);

// 게임 시작
startGame();

