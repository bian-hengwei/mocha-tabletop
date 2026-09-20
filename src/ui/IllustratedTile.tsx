type AtlasKind = 'sushi' | 'century' | 'covers';
const atlases = {
    sushi: { columns: 4, rows: 3, tileWidth: 100, tileHeight: 100, file: '/art/sushi-cards-v3.jpg' },
    century: { columns: 3, rows: 2, tileWidth: 100, tileHeight: 100, file: '/art/century-cards-v3.jpg' },
    covers: { columns: 3, rows: 2, tileWidth: 100, tileHeight: 150, file: '/art/game-covers-v3.jpg' },
};
/** The illustration is decorative; functional labels, costs and rules stay in HTML. */
export function IllustratedTile({ kind, index, className = '', fit = 'meet' }: { kind: AtlasKind; index: number; className?: string; fit?: 'meet' | 'slice' }) {
    const atlas = atlases[kind], tile = Math.max(0, Math.min(atlas.columns * atlas.rows - 1, index));
    const x = (tile % atlas.columns) * atlas.tileWidth, y = Math.floor(tile / atlas.columns) * atlas.tileHeight;
    return <svg className={`illustrated-tile ${className}`} viewBox={`0 0 ${atlas.tileWidth} ${atlas.tileHeight}`} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" focusable="false"><svg x="0" y="0" width={atlas.tileWidth} height={atlas.tileHeight} viewBox={`${x} ${y} ${atlas.tileWidth} ${atlas.tileHeight}`} overflow="hidden"><image href={atlas.file} width={atlas.columns * atlas.tileWidth} height={atlas.rows * atlas.tileHeight}/></svg></svg>;
}
