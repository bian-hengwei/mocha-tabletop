import { t } from '../i18n';
function tx<T>(value: T): T | string { return typeof value === 'string' ? t(value) : value; }
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { installState } from './installState';
import { useDialog } from './useDialog';
import './install.css';
export function InstallButton() {
    useSyncExternalStore(installState.subscribe, installState.snapshot);
    const [show, setShow] = useState(false), [notice, setNotice] = useState('');
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const installed = installState.installed;
    const panel = useDialog<HTMLElement>(show, () => setShow(false));
    useEffect(() => {
        if (installed)
            setShow(false);
    }, [installed]);
    const install = async () => {
        setNotice('');
        try {
            const outcome = await installState.request();
            if (outcome === 'unavailable')
                setShow(true);
            if (outcome === 'dismissed')
                setNotice('已取消，可稍后从浏览器菜单安装');
            if (outcome === 'accepted')
                setNotice('已确认安装，请等待系统完成');
        }
        catch {
            setNotice('暂时无法打开安装窗口，可从浏览器菜单重试');
            setShow(true);
        }
    };
    return <><button className="install-button" disabled={installed || installState.busy} onClick={() => void install()}><Smartphone size={16}/>{tx(installed ? '已添加到主屏幕' : installState.busy ? '正在打开安装…' : installState.available ? '安装到主屏幕' : isiOS ? '添加到 iPhone 主屏幕' : '添加到主屏幕')}{tx(installed ? <Check size={14}/> : <PlusSquare size={14}/>)}</button>{tx(notice && <small className="install-status" role="status">{tx(notice)}</small>)}{tx(show && <div className="modal-shade install-shade" onClick={() => setShow(false)}><section ref={panel} tabIndex={-1} className="panel install-panel" role="dialog" aria-modal="true" aria-label={t("添加到主屏幕")} onClick={e => e.stopPropagation()}><header><h2>{t("添加到主屏幕")}</h2><button className="icon" aria-label={t("关闭安装说明")} autoFocus onClick={() => setShow(false)}><X /></button></header><div className="install-preview"><img src="/mocha-icon-180.png" alt={t("桌游图标")}/><b>{t("Mocha 桌游")}</b></div>{tx(isiOS ? <><ol className="install-steps"><li><span>{t("1")}</span><div>{t("用") + " "}<b>{t("Safari")}</b>{" " + t("打开此页面")}</div></li><li><span>{t("2")}</span><div>{t("点击") + " "}<Share size={18}/> <b>{t("分享")}</b><small>{t("部分版本先点“更多 ···”，再点“分享”")}</small></div></li><li><span>{t("3")}</span><div>{t("选择") + " "}<PlusSquare size={18}/> <b>{t("添加到主屏幕")}</b><small>{t("如有“作为网页 App 打开”，保持开启")}</small></div></li><li><span>{t("4")}</span><div>{t("点") + " "}<b>{t("添加")}</b>{t("，从桌面图标进入")}</div></li></ol></> : <><ol className="install-steps"><li><span>{t("1")}</span><div>{t("打开浏览器菜单") + " "}<b>{t("⋮ / ⋯")}</b></div></li><li><span>{t("2")}</span><div>{t("选择") + " "}<b>{t("安装应用")}</b>{" " + t("或") + " "}<b>{t("添加到主屏幕")}</b></div></li><li><span>{t("3")}</span><div>{t("在系统窗口中确认安装")}</div></li></ol><p className="install-other">{t("如果菜单没有安装选项，请使用 Chrome 或 Edge 打开。")}</p></>)}</section></div>)}</>;
}
