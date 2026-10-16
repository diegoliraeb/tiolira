'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useRef} from 'react';
import {activityPage} from '../lib/activity.mjs';
import {trackActivity} from '../lib/track-activity';
export default function ActivityTracker(){const pathname=usePathname(),last=useRef('');useEffect(()=>{if(last.current===pathname||!activityPage(pathname))return;last.current=pathname;trackActivity({type:'page',path:pathname});},[pathname]);return null;}
