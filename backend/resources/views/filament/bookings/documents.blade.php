@php
    /** @var \App\Models\Booking $booking */
    $booking = $getRecord();
    $documents = $booking->documents->sortBy(fn ($document) => $document->type->value === 'license' ? 0 : 1);
@endphp

<div class="rental-documents">
    @forelse ($documents as $document)
        @php
            $url = route('filament.admin.documents.show', ['booking' => $booking, 'type' => $document->type->value]);
            $isImage = str_starts_with($document->mime_type, 'image/');
        @endphp
        <a href="{{ $url }}" target="_blank" rel="noopener" class="rental-document">
            @if ($isImage)
                <img src="{{ $url }}" alt="{{ $document->type->label() }}" loading="lazy">
            @else
                <span class="rental-document__file">
                    <x-filament::icon icon="heroicon-o-document-text" class="rental-document__icon" />
                    PDF
                </span>
            @endif
            <span class="rental-document__label">{{ $document->type->label() }}</span>
            <span class="rental-document__meta">{{ $document->original_name }} · {{ \Illuminate\Support\Number::fileSize($document->size) }}</span>
        </a>
    @empty
        <p class="rental-document__meta">
            @if ($booking->documents_deleted_at)
                Deleted {{ $booking->documents_deleted_at->setTimezone(config('rental.timezone'))->format('M j, Y') }}:
                documents are kept {{ config('rental.document_retention_days') }} days after the rental.
            @else
                Not uploaded yet.
            @endif
        </p>
    @endforelse
</div>

<style>
    .rental-documents { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
    .rental-document { display: flex; flex-direction: column; gap: .25rem; text-decoration: none; color: inherit; }
    .rental-document img, .rental-document__file {
        width: 100%; height: 11rem; object-fit: cover; border-radius: .5rem;
        border: 1px solid var(--gray-200); background: var(--gray-50);
    }
    .rental-document__file { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; font-weight: 600; color: var(--gray-500); }
    .rental-document__icon { width: 2.5rem; height: 2.5rem; }
    .rental-document:hover img, .rental-document:hover .rental-document__file { border-color: var(--primary-500); }
    .rental-document__label { margin-top: .25rem; font-weight: 600; font-size: .875rem; }
    .rental-document__meta { font-size: .8125rem; color: var(--gray-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dark .rental-document img, .dark .rental-document__file { border-color: var(--gray-700); background: var(--gray-800); }
</style>
