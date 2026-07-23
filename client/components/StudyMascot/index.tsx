import type { CSSProperties } from 'react';
import styles from './StudyMascot.module.css';

type StudyMascotProps = {
    size?: number;
    animated?: boolean;
    className?: string;
    title?: string;
};

export default function StudyMascot({
    size = 176,
    animated = true,
    className = '',
    title = 'Linh vật thỏ đeo kính đang chăm chú học bài',
}: StudyMascotProps) {
    return (
        <div
            className={[styles.mascot, animated ? styles.animated : '', className].filter(Boolean).join(' ')}
            style={{ '--mascot-size': `${size}px` } as CSSProperties}
        >
            <svg viewBox="0 0 400 400" role="img" aria-label={title} className={styles.svg}>
                <ellipse className={styles.shadow} cx="203" cy="348" rx="112" ry="16" />
                <g className={styles.rabbit}>
                    <g className={styles.leftEar}>
                        <path className={styles.fur} d="M125 153C73 95 81 40 114 30c38-10 68 63 64 129z" />
                        <path className={styles.innerEar} d="M120 129c-24-40-22-69-8-75 19-8 40 48 35 84z" />
                    </g>
                    <g className={styles.rightEar}>
                        <path className={styles.fur} d="M245 143c-5-71 28-123 63-113 35 11 21 84-30 132z" />
                        <path className={styles.innerEar} d="M264 125c8-47 26-69 41-63 16 8-1 54-33 85z" />
                    </g>

                    <path className={styles.fur} d="M117 321c-7-84 44-128 104-128 68 0 110 48 99 128z" />
                    <ellipse className={styles.belly} cx="208" cy="298" rx="57" ry="56" />

                    <g className={styles.head}>
                        <path
                            className={styles.fur}
                            d="M90 181c4-74 62-115 126-108 71 9 110 67 91 136-13 47-55 77-111 77-67 0-109-44-106-105z"
                        />
                        <path className={styles.face} d="M120 174c13-44 52-70 95-65 43 4 74 36 72 79-2 47-42 72-86 68-44-3-88-30-81-82z" />
                        <path className={styles.brow} d="M144 146c15-8 32-8 46 1m29-1c15-8 32-8 46 1" />
                        <g className={styles.glasses}>
                            <circle cx="165" cy="180" r="35" />
                            <circle cx="242" cy="180" r="35" />
                            <path d="M200 180h7" />
                        </g>
                        <circle className={styles.eye} cx="167" cy="185" r="12" />
                        <circle className={styles.eye} cx="240" cy="185" r="12" />
                        <circle className={styles.eyeLight} cx="163" cy="181" r="4" />
                        <circle className={styles.eyeLight} cx="236" cy="181" r="4" />
                        <path className={styles.nose} d="M203 206l8 7-8 7-8-7z" />
                        <path className={styles.mouth} d="M203 220c-4 10-14 12-21 7m21-7c5 10 15 12 22 7" />
                    </g>

                    <g className={styles.book}>
                        <path className={styles.bookLeft} d="M103 263c36-16 69-13 99 6v70c-29-19-61-21-99-5z" />
                        <path className={styles.bookRight} d="M202 269c30-19 63-22 99-6v71c-37-16-70-14-99 5z" />
                        <path className={styles.bookSpine} d="M202 269v70" />
                        <path className={styles.bookLine} d="M126 286c22-7 42-5 59 4m-59 16c22-7 42-5 59 4m35-20c18-9 39-10 60-4m-60 20c18-9 39-10 60-4" />
                    </g>

                    <g className={styles.leftPaw}>
                        <ellipse className={styles.furLight} cx="143" cy="291" rx="23" ry="18" transform="rotate(18 143 291)" />
                        <path className={styles.pawLine} d="M128 288l11 7m-4-13 11 7" />
                    </g>
                    <g className={styles.rightPaw}>
                        <ellipse className={styles.furLight} cx="265" cy="290" rx="23" ry="18" transform="rotate(-18 265 290)" />
                        <path className={styles.pawLine} d="M271 282l-11 7m17-1-11 7" />
                    </g>
                    <g className={styles.pencil}>
                        <path d="M289 222l18 18-55 55-20 2 2-20z" />
                        <path className={styles.pencilTip} d="M232 297l20-2-18-18z" />
                    </g>
                </g>
                <g className={styles.star}>
                    <path d="M95 228h21m-10-10v21" />
                </g>
            </svg>
        </div>
    );
}
