import type { CSSProperties } from 'react';
import styles from './WelcomeMascot.module.css';

type WelcomeMascotProps = {
    size?: number;
    animated?: boolean;
    className?: string;
    title?: string;
};

export default function WelcomeMascot({
    size = 300,
    animated = true,
    className = '',
    title = 'Linh vật thỏ đeo kính đang vẫy chào',
}: WelcomeMascotProps) {
    return (
        <div
            className={[styles.mascot, animated ? styles.animated : '', className].filter(Boolean).join(' ')}
            style={{ '--mascot-size': `${size}px` } as CSSProperties}
        >
            <svg viewBox="0 0 400 400" role="img" aria-label={title} className={styles.svg}>
                <ellipse className={styles.shadow} cx="204" cy="341" rx="112" ry="17" />

                <g className={styles.rabbit}>
                    <g className={styles.leftEar}>
                        <path className={styles.fur} d="M124 151C71 92 81 37 114 29c38-9 67 62 63 126z" />
                        <path className={styles.innerEar} d="M118 128c-25-41-22-70-7-75 19-6 38 48 34 84z" />
                    </g>
                    <g className={styles.rightEar}>
                        <path className={styles.fur} d="M244 143c-5-72 27-124 62-115 36 10 22 83-29 132z" />
                        <path className={styles.innerEar} d="M263 125c8-48 26-70 41-64 16 8-1 54-32 86z" />
                    </g>

                    <path className={styles.fur} d="M117 317c-7-83 44-128 103-128 70 0 111 49 100 128z" />
                    <ellipse className={styles.belly} cx="207" cy="291" rx="56" ry="60" />

                    <g className={styles.head}>
                        <path
                            className={styles.fur}
                            d="M91 179c3-74 62-116 125-108 72 9 111 68 91 137-12 46-55 76-110 76-67 0-109-44-106-105z"
                        />
                        <path className={styles.face} d="M121 172c12-44 51-70 94-65 43 4 74 37 72 80-3 47-43 71-86 67-44-3-88-30-80-82z" />
                        <path className={styles.brow} d="M143 143c16-10 33-10 48 0M218 143c16-10 33-10 48 0" />
                        <g className={styles.glasses}>
                            <circle cx="164" cy="177" r="35" />
                            <circle cx="242" cy="177" r="35" />
                            <path d="M199 177h8" />
                        </g>
                        <circle className={styles.eye} cx="166" cy="181" r="12" />
                        <circle className={styles.eye} cx="240" cy="181" r="12" />
                        <circle className={styles.eyeLight} cx="162" cy="177" r="4" />
                        <circle className={styles.eyeLight} cx="236" cy="177" r="4" />
                        <path className={styles.nose} d="M203 203l8 7-8 7-8-7z" />
                        <path className={styles.mouth} d="M203 217c-5 11-15 13-22 8m22-8c5 11 15 13 22 8" />
                    </g>

                    <g className={styles.waveArm}>
                        <path
                            className={styles.furLight}
                            d="M253 275c8-49 30-98 58-120 13-11 29-4 30 12 1 20-14 37-27 52l-25 76z"
                        />
                        <path className={styles.pawLine} d="M313 164l13 10m-18 0 13 11m-19 1 12 11" />
                    </g>
                    <g className={styles.heldArm}>
                        <path className={styles.furLight} d="M126 268c23 2 42 20 52 43l-32 14c-10-17-22-25-37-28z" />
                        <path className={styles.pawLine} d="M143 302l13 8m-7-16 14 8" />
                    </g>
                </g>

                <g className={`${styles.spark} ${styles.sparkOne}`}>
                    <path d="M77 165h26M90 152v26" />
                </g>
                <g className={`${styles.spark} ${styles.sparkTwo}`}>
                    <path d="M313 115h22M324 104v22" />
                </g>
                <g className={`${styles.spark} ${styles.sparkThree}`}>
                    <path d="M314 305h18M323 296v18" />
                </g>
                <path className={styles.ribbon} d="M76 270c16-25 31-22 43-9-12 12-24 15-43 9z" />
            </svg>
        </div>
    );
}
