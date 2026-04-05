'use client';

// hooks/useNavigationGuard.js

import { useEffect } from "react";

export const useNavigationGuard = ({ enabled, onAttempt }) => {

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e) => {
            const isF5 = e.key === "F5";
            const isCtrlR = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r";

            if (isF5 || isCtrlR) {
                e.preventDefault();
                e.stopPropagation();
                onAttempt("refresh");
            }
        };

        const handleBeforeUnload = (e) => {
            if (enabled) {
                e.preventDefault();
                e.returnValue = "Are you sure you want to leave?";
                return e.returnValue;
            }
        };

        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, "", window.location.href);
            onAttempt("back");
        };

        window.addEventListener("keydown", handleKeyDown, { capture: true });
        window.addEventListener("beforeunload", handleBeforeUnload, { capture: true });
        window.addEventListener("popstate", handlePopState);

        window.history.pushState(null, "", window.location.href);

        return () => {
            window.removeEventListener("keydown", handleKeyDown, { capture: true });
            window.removeEventListener("beforeunload", handleBeforeUnload, { capture: true });
            window.removeEventListener("popstate", handlePopState);
        };

    }, [enabled, onAttempt]);
};