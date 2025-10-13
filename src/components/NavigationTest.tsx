import { useNavigation } from '../contexts/NavigationContext';

export function NavigationTest() {
  const { selectedProject, selectedVideo } = useNavigation();

  return (
    <div style={{
      position: 'fixed',
      left: '300px',
      top: '10px',
      padding: '10px',
      background: '#fffbeb',
      border: '2px solid #f59e0b',
      borderRadius: '6px',
      zIndex: 1000,
      fontSize: '12px',
      maxWidth: '400px'
    }}>
      <strong>🎯 Navigation Selection Test</strong>
      <div style={{ marginTop: '5px' }}>
        <strong>Selected Project:</strong>{' '}
        {selectedProject ? (
          <span style={{ color: '#059669' }}>{selectedProject.title} (ID: {selectedProject.id})</span>
        ) : (
          <span style={{ color: '#999' }}>None</span>
        )}
      </div>
      <div style={{ marginTop: '3px' }}>
        <strong>Selected Video:</strong>{' '}
        {selectedVideo ? (
          <span style={{ color: '#0284c7' }}>{selectedVideo.title} (ID: {selectedVideo.id})</span>
        ) : (
          <span style={{ color: '#999' }}>None</span>
        )}
      </div>
    </div>
  );
}