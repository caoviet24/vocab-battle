import type { CSSProperties } from 'react';
import styles from './CongratulatoryMascot.module.css';

type CongratulatoryMascotProps = {
    /** Chiều rộng linh vật, đơn vị px. */
    size?: number;
    /** Bật hoặc tắt toàn bộ chuyển động. */
    animated?: boolean;
    /** Hiển thị nền tím than như ảnh mẫu. */
    withBackground?: boolean;
    /** Thời gian một nhịp thổi kèn, đơn vị giây. Nhỏ hơn = nhanh hơn. */
    speed?: number;
    className?: string;
    title?: string;
};

export default function CongratulatoryMascot({
    size = 440,
    animated = true,
    withBackground = false,
    speed = 1.55,
    className = '',
    title = 'Linh vật thỏ màu kem đeo kính thổi kèn chúc mừng',
}: CongratulatoryMascotProps) {
    const rootClassName = [
        styles.mascot,
        animated ? styles.animated : '',
        withBackground ? styles.withBackground : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={rootClassName}
            style={
                {
                    '--mascot-size': `${size}px`,
                    '--celebration-cycle': `${Math.max(0.85, speed)}s`,
                } as CSSProperties
            }
        >
            <svg viewBox="0 0 640 640" role="img" aria-label={title} className={styles.svg}>
                <defs>
                    <linearGradient id="rabbitFur" x1="0.15" y1="0.05" x2="0.8" y2="0.95">
                        <stop offset="0%" stopColor="#ffe1aa" />
                        <stop offset="52%" stopColor="#ffc982" />
                        <stop offset="100%" stopColor="#f2a95e" />
                    </linearGradient>

                    <linearGradient id="rabbitLight" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fff4d3" />
                        <stop offset="100%" stopColor="#ffd69b" />
                    </linearGradient>

                    <linearGradient id="innerEar" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ff9d7d" />
                        <stop offset="100%" stopColor="#ed6a5f" />
                    </linearGradient>

                    <linearGradient id="copperHorn" x1="0" y1="0.1" x2="1" y2="0.9">
                        <stop offset="0%" stopColor="#ffc089" />
                        <stop offset="48%" stopColor="#e98552" />
                        <stop offset="100%" stopColor="#ad4e2e" />
                    </linearGradient>

                    <linearGradient id="hornHighlight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ffd5b3" />
                        <stop offset="100%" stopColor="#f18b5a" />
                    </linearGradient>

                    <linearGradient id="ribbonTeal" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#178e8b" />
                        <stop offset="100%" stopColor="#086b72" />
                    </linearGradient>

                    <radialGradient id="eyeWhite" cx="34%" cy="22%" r="86%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#fff9ef" />
                    </radialGradient>

                    <filter id="characterShadow" x="-35%" y="-35%" width="180%" height="190%">
                        <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#151126" floodOpacity="0.32" />
                    </filter>

                    <filter id="detailShadow" x="-60%" y="-60%" width="220%" height="220%">
                        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#3a1e16" floodOpacity="0.25" />
                    </filter>

                    <clipPath id="leftEyeClip">
                        <ellipse cx="269" cy="257" rx="57" ry="64" />
                    </clipPath>
                    <clipPath id="rightEyeClip">
                        <ellipse cx="383" cy="254" rx="57" ry="64" />
                    </clipPath>
                </defs>

                <ellipse
                    className={styles.groundShadow}
                    cx="303"
                    cy="568"
                    rx="176"
                    ry="23"
                    fill="#181526"
                    opacity="0.48"
                />

                <g className={styles.rabbit} filter="url(#characterShadow)">
                    {/* Tai nằm sau đầu */}
                    <g className={`${styles.ear} ${styles.leftEar}`}>
                        <path
                            d="M219 193c-46-28-93-77-89-128 3-36 30-49 57-27 37 30 60 92 58 142z"
                            fill="url(#rabbitFur)"
                        />
                        <path
                            d="M213 171c-31-28-59-68-60-104 0-18 11-24 24-13 24 20 41 66 44 107z"
                            fill="url(#innerEar)"
                            opacity="0.9"
                        />
                        <path
                            d="M145 51c18-15 38-10 57 13"
                            fill="none"
                            stroke="#fff2cf"
                            strokeWidth="8"
                            strokeLinecap="round"
                            opacity="0.75"
                        />
                    </g>

                    <g className={`${styles.ear} ${styles.rightEar}`}>
                        <path
                            d="M382 183c2-54 24-118 61-151 30-27 64-15 70 24 8 53-34 109-96 139z"
                            fill="url(#rabbitFur)"
                        />
                        <path
                            d="M401 171c8-43 25-88 49-111 15-15 27-9 27 11 0 38-28 79-67 108z"
                            fill="url(#innerEar)"
                            opacity="0.9"
                        />
                        <path
                            d="M454 39c22-15 42-6 52 19"
                            fill="none"
                            stroke="#fff2cf"
                            strokeWidth="8"
                            strokeLinecap="round"
                            opacity="0.75"
                        />
                    </g>

                    {/* Đuôi */}
                    <g className={styles.tail} fill="url(#rabbitLight)">
                        <circle cx="166" cy="465" r="25" />
                        <circle cx="146" cy="475" r="19" />
                        <circle cx="163" cy="489" r="18" />
                    </g>

                    {/* Thân */}
                    <g className={styles.bodyGroup}>
                        <path
                            className={styles.body}
                            d="M229 373c-39 27-59 77-55 131 3 48 20 69 59 70h150c39-2 58-25 59-70 2-56-20-104-60-131z"
                            fill="url(#rabbitFur)"
                        />
                        <ellipse cx="319" cy="465" rx="61" ry="88" fill="url(#rabbitLight)" opacity="0.86" />
                        <path
                            d="M263 399c11 9 24 14 39 15"
                            fill="none"
                            stroke="#e8954f"
                            strokeWidth="5"
                            strokeLinecap="round"
                            opacity="0.58"
                        />
                    </g>

                    {/* Chân */}
                    <g className={styles.feet} fill="url(#rabbitFur)">
                        <path d="M216 508c-12 19-14 42-5 62 10 20 39 22 65 8 10-6 9-19-2-24-10-5-18-9-25-16-7-8-13-18-18-30z" />
                        <path d="M351 506c-4 22-3 43 5 62 8 20 38 23 64 9 11-6 10-19 0-24-12-6-21-12-28-21-6-7-10-16-13-26z" />
                        <path
                            d="M230 563c11-9 23-9 36 1"
                            fill="none"
                            stroke="#d98848"
                            strokeWidth="5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M370 563c11-9 23-9 36 1"
                            fill="none"
                            stroke="#d98848"
                            strokeWidth="5"
                            strokeLinecap="round"
                        />
                    </g>

                    {/* Đầu */}
                    <g className={styles.headGroup}>
                        <path
                            className={styles.head}
                            d="M201 169c33-49 96-70 157-57 71 15 116 70 113 136-1 20 7 34 21 47 11 11 9 25-5 32-8 4-17 4-26 1-13 48-58 82-118 90-65 8-125-13-155-59-28-43-26-101 13-190z"
                            fill="url(#rabbitFur)"
                        />

                        <path
                            d="M211 193c28-46 78-68 130-62-45 10-78 38-94 82-15 40-11 85 8 119-36-25-54-78-44-139z"
                            fill="#fff0c8"
                            opacity="0.3"
                        />

                        {/* Má và lông má */}
                        <path
                            d="M202 317c-15 7-23 17-24 30 11 1 20-2 27-8-6 12-3 22 9 29 10-9 15-21 13-36z"
                            fill="url(#rabbitFur)"
                        />
                        <path
                            d="M450 314c15 6 24 16 26 29-11 2-20-1-28-7 7 11 4 22-8 29-10-9-15-21-13-36z"
                            fill="url(#rabbitFur)"
                        />

                        {/* Chỏm lông */}
                        <g className={styles.forelock} fill="url(#rabbitFur)">
                            <path d="M305 123c3-19 15-31 35-37-2 16-10 29-24 39z" />
                            <path d="M327 124c10-16 25-25 43-25-7 15-17 25-32 31z" />
                        </g>

                        {/* Lông mày */}
                        <path
                            className={`${styles.brow} ${styles.leftBrow}`}
                            d="M237 193c17-12 35-14 53-5"
                            fill="none"
                            stroke="#572619"
                            strokeWidth="11"
                            strokeLinecap="round"
                        />
                        <path
                            className={`${styles.brow} ${styles.rightBrow}`}
                            d="M358 188c17-9 35-8 53 3"
                            fill="none"
                            stroke="#572619"
                            strokeWidth="11"
                            strokeLinecap="round"
                        />

                        {/* Mắt */}
                        <g className={`${styles.eye} ${styles.leftEye}`}>
                            <ellipse cx="269" cy="257" rx="57" ry="64" fill="url(#eyeWhite)" />
                            <g className={`${styles.pupil} ${styles.leftPupil}`} clipPath="url(#leftEyeClip)">
                                <ellipse cx="279" cy="269" rx="27" ry="34" fill="#41150f" />
                                <circle cx="268" cy="253" r="9" fill="#ffffff" />
                                <circle cx="289" cy="282" r="4" fill="#8f4c3a" opacity="0.42" />
                            </g>
                        </g>

                        <g className={`${styles.eye} ${styles.rightEye}`}>
                            <ellipse cx="383" cy="254" rx="57" ry="64" fill="url(#eyeWhite)" />
                            <g className={`${styles.pupil} ${styles.rightPupil}`} clipPath="url(#rightEyeClip)">
                                <ellipse cx="392" cy="266" rx="27" ry="34" fill="#41150f" />
                                <circle cx="381" cy="250" r="9" fill="#ffffff" />
                                <circle cx="402" cy="279" r="4" fill="#8f4c3a" opacity="0.42" />
                            </g>
                        </g>

                        {/* Kính */}
                        <g
                            className={styles.glasses}
                            fill="none"
                            stroke="#5a281b"
                            strokeWidth="9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <ellipse cx="269" cy="257" rx="64" ry="71" />
                            <ellipse cx="383" cy="254" rx="64" ry="71" />
                            <path d="M332 247c10-5 19-5 29 0" />
                            <path d="M207 253c-18 3-31 8-43 17" />
                            <path d="M446 251c14 0 26 3 37 10" />
                        </g>

                        {/* Mũi, miệng */}
                        <ellipse className={styles.nose} cx="330" cy="323" rx="17" ry="11" fill="#f47f68" />
                        <ellipse cx="325" cy="319" rx="7" ry="4" fill="#ffc0ad" opacity="0.8" />
                        <path
                            d="M330 332c0 14-9 20-18 20-7 0-12-3-16-9"
                            fill="none"
                            stroke="#572619"
                            strokeWidth="5"
                            strokeLinecap="round"
                        />
                        <path
                            d="M330 332c0 14 8 20 17 20 8 0 14-3 17-10"
                            fill="none"
                            stroke="#572619"
                            strokeWidth="5"
                            strokeLinecap="round"
                        />

                        <g className={styles.mouth}>
                            <path d="M318 349c11 7 23 7 35 0 0 19-8 29-18 29-11 0-17-10-17-29z" fill="#572619" />
                            <ellipse cx="335" cy="368" rx="10" ry="6" fill="#df4770" />
                        </g>

                        <path
                            d="M279 346c8 12 9 25 3 37"
                            fill="none"
                            stroke="#d88646"
                            strokeWidth="5"
                            strokeLinecap="round"
                            opacity="0.7"
                        />
                    </g>

                    {/* Cụm tay + kèn cùng chuyển động */}
                    <g className={styles.instrumentRig} filter="url(#detailShadow)">
                        {/* Tay dưới */}
                        <path
                            className={styles.lowerArm}
                            d="M301 401c18-42 38-66 61-71 17-4 28 13 19 28-12 20-23 43-30 69-7 26-28 32-44 19-11-9-13-27-6-45z"
                            fill="url(#rabbitFur)"
                        />
                        <g className={styles.lowerPaw} fill="url(#rabbitLight)">
                            <ellipse cx="367" cy="357" rx="28" ry="24" transform="rotate(-22 367 357)" />
                            <path
                                d="M350 354c8 1 15 5 20 12"
                                fill="none"
                                stroke="#dc8e52"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                            <path
                                d="M359 345c8 2 14 7 18 14"
                                fill="none"
                                stroke="#dc8e52"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        </g>

                        {/* Kèn */}
                        <g className={styles.horn}>
                            <ellipse cx="373" cy="339" rx="13" ry="18" fill="#bb5e3b" />
                            <rect x="374" y="326" width="122" height="27" rx="13" fill="url(#hornHighlight)" />
                            <path
                                d="M382 331h104"
                                fill="none"
                                stroke="#ffd9bf"
                                strokeWidth="5"
                                strokeLinecap="round"
                                opacity="0.64"
                            />

                            <g className={styles.ribbon}>
                                <path d="M441 316c19-5 35-3 48 6l-2 50c-15 8-31 8-48 1z" fill="url(#ribbonTeal)" />
                                <path d="M446 362c-2 31-8 54-19 72l25-7 16 18c9-25 13-50 11-76z" fill="#168c88" />
                                <path d="M476 366c5 27 14 49 28 66l8-22 21-6c-17-20-29-40-36-61z" fill="#087078" />
                                <path
                                    d="M447 326c12-3 24-2 35 3"
                                    fill="none"
                                    stroke="#4cc3b9"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    opacity="0.65"
                                />
                            </g>

                            <path
                                className={styles.hornBell}
                                d="M484 318c42-3 80-18 109-45v121c-31-28-67-43-109-47z"
                                fill="url(#copperHorn)"
                            />
                            <ellipse cx="594" cy="334" rx="19" ry="64" fill="#b45131" />
                            <ellipse cx="590" cy="334" rx="12" ry="53" fill="#ef9766" />
                            <path
                                d="M520 306c24-8 46-19 64-34"
                                fill="none"
                                stroke="#ffd7bb"
                                strokeWidth="6"
                                strokeLinecap="round"
                                opacity="0.58"
                            />
                        </g>

                        {/* Tay trên giữ kèn */}
                        <g className={styles.upperPaw} fill="url(#rabbitLight)">
                            <ellipse cx="430" cy="320" rx="30" ry="25" transform="rotate(16 430 320)" />
                            <path
                                d="M416 313c6 4 10 10 11 18"
                                fill="none"
                                stroke="#dc8e52"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                            <path
                                d="M427 309c6 5 9 11 9 19"
                                fill="none"
                                stroke="#dc8e52"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                            <path
                                d="M438 310c5 5 7 11 7 18"
                                fill="none"
                                stroke="#dc8e52"
                                strokeWidth="4"
                                strokeLinecap="round"
                            />
                        </g>
                    </g>
                </g>

                {/* Nốt nhạc */}
                <g className={`${styles.note} ${styles.noteOne}`} fill="#d8f238">
                    <circle cx="529" cy="170" r="12" />
                    <circle cx="570" cy="154" r="12" />
                    <path
                        d="M538 168v-55l43-10v50"
                        fill="none"
                        stroke="#d8f238"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>

                <g className={`${styles.note} ${styles.noteTwo}`} fill="#c47bdc">
                    <circle cx="520" cy="242" r="11" />
                    <circle cx="558" cy="229" r="11" />
                    <path
                        d="M528 240v-48l39-9v45"
                        fill="none"
                        stroke="#c47bdc"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>

                <g className={`${styles.note} ${styles.noteThree}`} fill="#27c9c2">
                    <circle cx="485" cy="290" r="9" />
                    <path
                        d="M492 288v-36l22-5"
                        fill="none"
                        stroke="#27c9c2"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>

                <g className={`${styles.spark} ${styles.sparkOne}`} fill="#fff6a9">
                    <path d="M579 441l7 16 16 7-16 7-7 16-7-16-16-7 16-7z" />
                </g>
            </svg>
        </div>
    );
}
