<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/** @property string $actor_name */
class Activity extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['before' => 'array', 'after' => 'array'];

    protected static function booted(): void
    {
        // Payload erasure on permanent deletion is narrowly handled in TrashWorkspace.
        static::updating(fn () => throw new LogicException('Audit ist unveränderlich.'));
        static::deleting(fn () => throw new LogicException('Audit ist unveränderlich.'));
    }
}
