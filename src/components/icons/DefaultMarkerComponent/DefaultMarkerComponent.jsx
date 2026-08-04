// figma node: 40:17 Default marker component
export function DefaultMarkerComponent(_p = {}) {
  const props = _p;
  return (
    <div className={props.className} style={{
      width: 16,
      height: 20,
      position: "relative",
      ...props.style,
    }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 16,
        height: 20,
        overflow: "hidden",
      }}>
        <svg width={14.913} height={19.119} viewBox="0 0 14.913 19.119" fill="none" style={{
          position: "absolute",
          left: 0.106,
          top: 0.195,
          width: 14.913,
          height: 19.119,
          color: "rgb(29,174,239)",
        }}>
          <path d={"M 7.456 19.119 C 7.852 19.119 14.913 11.575 14.913 7.456 C 14.913 3.338 11.574 0 7.456 0 C 3.338 0 0 3.338 0 7.456 C 0 11.575 7.061 19.119 7.456 19.119 Z M 7.456 11.186 C 9.544 11.186 11.237 9.493 11.237 7.405 C 11.237 5.318 9.544 3.625 7.456 3.625 C 5.369 3.625 3.676 5.318 3.676 7.405 C 3.676 9.493 5.369 11.186 7.456 11.186 Z"} fill="currentColor" fillRule="evenodd" />
        </svg>
        <svg width={7.456} height={19.119} viewBox="0 0 7.456 19.119" fill="none" style={{
          position: "absolute",
          left: 0.106,
          top: 0.195,
          width: 7.456,
          height: 19.119,
          color: "rgb(62,195,255)",
        }}>
          <path d={"M 0 7.456 C 0 11.575 7.061 19.119 7.456 19.119 L 7.456 11.186 C 5.369 11.186 3.676 9.493 3.676 7.405 C 3.676 5.318 5.369 3.625 7.456 3.625 L 7.456 0 C 3.338 0 0 3.338 0 7.456 Z"} fill="currentColor" fillRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}
export default DefaultMarkerComponent;
